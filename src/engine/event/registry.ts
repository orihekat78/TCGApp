// engine.event — Hook Registry 実装
// spec: .claude/specs/engine-api-events.md
// rules: 15-abilities-effects.md
//
// 設計メモ:
//   - Registry は **モジュールレベルのシングルトン** (Map<HookName, Listener[]>)
//   - 理由: Immer の produce() は state を新規オブジェクトに置き換えるため、
//     state-keyed (WeakMap) では listener が mutation 間で失われる
//   - listener は関数 (非 JSON) なので state には直接保存できない
//   - pendingEffects (Effect[] = JSON-serializable) は GameState 内に保持
//   - テスト用に _resetRegistry() を公開

import type {
  GameState,
  HookName,
  Effect,
  Unsubscribe,
  EffectStackEntry,
  EffectStackEntrySource,
} from '../types/index.js';
import {
  currentEffectCausalCorrelationEventId,
  withEffectCausalCorrelation,
} from '../log/effect-causal.js';
import { assertAbilitySourceIdentity } from '../effect/source-identity.js';

export type Listener = (state: GameState, payload: unknown, source: unknown) => Effect | void;

const registry: Map<HookName, Listener[]> = new Map();

let suppressedEventDepth = 0;
type JournaledEmit = {
  state: GameState;
  name: HookName;
  payload: unknown;
  source?: unknown;
  causalCorrelationEventId?: string;
};
let eventJournal: JournaledEmit[] | null = null;

/** Run a preparation pass without invoking listener closures or queueing effects. */
export function _withEventsSuppressed<T>(fn: () => T): T {
  suppressedEventDepth += 1;
  try {
    return fn();
  } finally {
    suppressedEventDepth -= 1;
  }
}

/** Delay listener execution until a cost transaction has fully committed. */
export function _beginEventJournal(): JournaledEmit[] {
  if (eventJournal !== null) throw new Error('event journal is already active');
  eventJournal = [];
  return eventJournal;
}

export function _abortEventJournal(journal: JournaledEmit[]): void {
  if (eventJournal === journal) eventJournal = null;
}

export function _commitEventJournal(journal: JournaledEmit[]): void {
  if (eventJournal !== journal) return;
  eventJournal = null;
  for (const entry of journal) {
    emitNow(
      entry.state,
      entry.name,
      entry.payload,
      entry.source,
      entry.causalCorrelationEventId,
    );
  }
}

function nextEntryId(state: GameState): string {
  let seq = state.effectEntrySeq ?? 0;
  for (const entry of state.pendingEffects) {
    const match = /^e_(\d+)$/.exec(entry.id);
    if (match) seq = Math.max(seq, Number(match[1]));
  }
  state.effectEntrySeq = seq + 1;
  return `e_${state.effectEntrySeq}`;
}

// Resolution lock — module-level alongside the registry. UI consults via
// engine.resolve.isLocked. Set by engine.resolve.lock / unlock.
let resolutionLocked = false;
let resolutionLockReason: string | null = null;

export function _getResolutionLock(): { locked: boolean; reason: string | null } {
  return { locked: resolutionLocked, reason: resolutionLockReason };
}

export function _setResolutionLock(locked: boolean, reason: string | null): void {
  resolutionLocked = locked;
  resolutionLockReason = reason;
}

function normalizeSource(raw: unknown): EffectStackEntrySource {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<EffectStackEntrySource> & Record<string, unknown>;
    assertAbilitySourceIdentity(r);
    const player: 'self' | 'opp' = r.player === 'opp' ? 'opp' : 'self';
    const src: EffectStackEntrySource = { player };
    if (typeof r.uid === 'string') src.uid = r.uid;
    if (typeof r.cardId === 'string') src.cardId = r.cardId;
    if (typeof r.setCardId === 'string') src.setCardId = r.setCardId;
    if (typeof r.setCardInstanceId === 'string') src.setCardInstanceId = r.setCardInstanceId;
    if (r.abilityOrigin === 'printed' || r.abilityOrigin === 'granted') src.abilityOrigin = r.abilityOrigin;
    if (typeof r.abilityIndex === 'number') src.abilityIndex = r.abilityIndex;
    if (typeof r.abilityId === 'string') src.abilityId = r.abilityId;
    if (typeof r.description === 'string') src.description = r.description;
    if (r.area === 'scene' || r.area === 'partner-area' || r.area === 'hand' || r.area === 'evidence'
      || r.area === 'file' || r.area === 'remove' || r.area === 'case') src.area = r.area;
    if (r.resolutionKind === 'normal-event' || r.resolutionKind === 'hirameki' || r.resolutionKind === 'cutin') {
      src.resolutionKind = r.resolutionKind;
    }
    return src;
  }
  return { player: 'self' };
}

/**
 * Wrap an Effect into an EffectStackEntry with the supplied trigger context.
 * Exposed so callers (e.g., engine.resolve.queue) can construct entries
 * outside the emit flow while sharing the same defaults.
 */
export function buildEntry(
  state: GameState,
  effect: Effect,
  opts: {
    hook?: string;
    payload?: unknown;
    source?: unknown;
    /**
     * 2026-05-27 (Option C follow-up): queue 時点の bindings を entry に永続化。
     * 主にカットイン (`$contact.byUid` 等) で使用。entryToCtx が復元する。
     */
    bindings?: Record<string, unknown[]>;
    /** Captured parent-effect root. `inheritCausalCorrelation=false` preserves undefined. */
    causalCorrelationEventId?: string;
    inheritCausalCorrelation?: boolean;
  } = {},
): EffectStackEntry {
  // Validate public occurrence provenance before consuming the stack sequence.
  // A rejected source must leave GameState byte-identical.
  const source = normalizeSource(opts.source);
  const causalCorrelationEventId = opts.inheritCausalCorrelation === false
    ? opts.causalCorrelationEventId
    : opts.causalCorrelationEventId ?? currentEffectCausalCorrelationEventId(state);
  return {
    id: nextEntryId(state),
    source,
    triggeredBy: { hook: opts.hook ?? 'manual', payload: opts.payload },
    triggeredAt: {
      turn: state.turn.number,
      phase: state.turn.phase,
      nano: Date.now(),
    },
    effect,
    state: 'pending',
    bindings: opts.bindings,
    ...(causalCorrelationEventId ? { causalCorrelationEventId } : {}),
  };
}

/**
 * Hook 名に listener を登録する。
 * 戻り値の Unsubscribe を呼ぶと登録解除される。
 */
function on(name: HookName, listener: Listener): Unsubscribe {
  let list = registry.get(name);
  if (!list) {
    list = [];
    registry.set(name, list);
  }
  list.push(listener);

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    const cur = registry.get(name);
    if (!cur) return;
    const idx = cur.indexOf(listener);
    if (idx !== -1) cur.splice(idx, 1);
  };
}

/**
 * Hook 発火: 登録されている listener を順に呼ぶ。
 * Listener が Effect を返したら state.pendingEffects に積む (queue 経由)。
 */
export type EmitOptions = {
  /** Explicit public cause. When present, it wins over ambient effect context. */
  causalCorrelationEventId?: string;
};

function emit(
  state: GameState,
  name: HookName,
  payload: unknown,
  source?: unknown,
  options?: EmitOptions,
): void {
  // Public source authority is validated before suppression, journaling,
  // listener lookup, or any GameState/listener mutation. Keep the raw object
  // for hook-specific fields; normalizeSource is the shared boundary check.
  normalizeSource(source);
  if (suppressedEventDepth > 0) return;
  const causalCorrelationEventId = options?.causalCorrelationEventId
    ?? currentEffectCausalCorrelationEventId(state);
  if (eventJournal !== null) {
    eventJournal.push({
      state,
      name,
      payload,
      source,
      ...(causalCorrelationEventId ? { causalCorrelationEventId } : {}),
    });
    return;
  }
  emitNow(state, name, payload, source, causalCorrelationEventId);
}

function emitNow(
  state: GameState,
  name: HookName,
  payload: unknown,
  source: unknown,
  causalCorrelationEventId: string | undefined,
): void {
  const list = registry.get(name);
  if (!list || list.length === 0) return;
  // スナップショット (listener が listener を解除しても列挙が壊れないように)
  const snapshot = list.slice();
  const priorBatch = state.pendingEffects.reduce(
    (max, entry) => Math.max(max, entry.triggerBatch ?? 0),
    state.effectTriggerBatchSeq ?? 0,
  );
  const triggerBatch = priorBatch + 1;
  state.effectTriggerBatchSeq = triggerBatch;
  const parentBatch = state.effectTriggerBatchContext;
  const parentConfirmed = state.effectTriggerBatchConfirmedContext;
  state.effectTriggerBatchContext = triggerBatch;
  // A new hook emission is a new simultaneous timing. Confirmation belongs
  // only to the resolving parent batch and must not auto-confirm this batch.
  delete state.effectTriggerBatchConfirmedContext;
  try {
    for (const listener of snapshot) {
      const result = withEffectCausalCorrelation(
        state,
        causalCorrelationEventId,
        () => listener(state, payload, source),
      );
      // queue() returns its created stack entry for direct callers that need
      // declaration provenance. An expression-bodied listener may therefore
      // return that entry incidentally; it is already queued and must never be
      // treated as a second Effect.
      if (!result || !('kind' in result)) continue;
      // 発火時の hook 名・payload・source を EffectStackEntry に転記する
      const entry = buildEntry(state, result, {
        hook: name,
        payload,
        source,
        causalCorrelationEventId,
        inheritCausalCorrelation: false,
      });
      entry.triggerBatch = triggerBatch;
      state.pendingEffects.push(entry);
    }
  } finally {
    if (parentBatch === undefined) delete state.effectTriggerBatchContext;
    else state.effectTriggerBatchContext = parentBatch;
    if (parentConfirmed === undefined) delete state.effectTriggerBatchConfirmedContext;
    else state.effectTriggerBatchConfirmedContext = parentConfirmed;
  }
}

/**
 * Effect を pendingEffects に追加する。
 * emit からも、外部からも呼べる (Resolver / 個別 listener が直接 queue したい場合)。
 * Effect を渡すと内部で EffectStackEntry にラップする。
 */
function queue(
  state: GameState,
  effect: Effect,
  source?: unknown,
  hook?: string,
  payload?: unknown,
  bindings?: Record<string, unknown[]>,
  // BUG-132 GAP-2 (2026-06-12): effect:declared の batch gate / 遅延 pick 用 entry 追加 field。
  // triggered.ts handleHook のみが渡す (他 caller は省略で従来挙動)。
  // engine additive wave (2026-06-29d): costPaid も同経路で entry へ載せる (declared-ability.ts が渡す)。
  // BUG-171 (2026-07-04): dyn も同型永続化 (declaredName 供給チャネルの queue-boundary 喪失修正)。
  entryExtras?: Pick<EffectStackEntry,
    | 'declaredBatch'
    | 'declaredReaction'
    | 'costPaid'
    | 'dyn'
    | 'publicHandRevealToken'
    | 'causalTrace'
    | 'causalCorrelationEventId'
    | 'triggerBatch'
    | 'ownerChosenOrder'
    | 'ownerOrderConfirmed'
    | 'resumesCurrentEffect'
    | 'deferredPicks'
    | 'reasoningContinuation'
  >,
): EffectStackEntry {
  if (entryExtras?.causalTrace !== undefined && entryExtras.causalCorrelationEventId !== undefined) {
    throw new Error('causal trace and child correlation are mutually exclusive');
  }
  const entry = buildEntry(state, effect, { hook: hook ?? 'manual', payload, source, bindings });
  if (entryExtras?.causalTrace !== undefined) delete entry.causalCorrelationEventId;
  if (entryExtras) Object.assign(entry, entryExtras);
  entry.triggerBatch ??= state.effectTriggerBatchContext;
  // Confirmation is a decision about the already-resolving effect. Only an
  // explicit continuation (pick/choice/optional resume) may retain it; a
  // newly queued child is a fresh unresolved effect and must be orderable.
  if (entry.resumesCurrentEffect === true) {
    entry.ownerOrderConfirmed ??= state.effectTriggerBatchConfirmedContext;
  }
  state.pendingEffects.push(entry);
  return entry;
}

/**
 * テスト用: registry を完全クリア。エントリ ID カウンタと解決ロックもリセット。
 */
function _resetRegistry(): void {
  registry.clear();
  suppressedEventDepth = 0;
  eventJournal = null;
  resolutionLocked = false;
  resolutionLockReason = null;
}

export const event = {
  on,
  emit,
  queue,
  _resetRegistry,
};
