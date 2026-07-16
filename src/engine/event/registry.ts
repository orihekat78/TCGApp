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

export type Listener = (state: GameState, payload: unknown, source: unknown) => Effect | void;

const registry: Map<HookName, Listener[]> = new Map();

// Auto-increment counter for EffectStackEntry IDs. Module-level singleton.
let entryIdCounter = 0;

function nextEntryId(): string {
  entryIdCounter += 1;
  return `e_${entryIdCounter}`;
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
    const player: 'self' | 'opp' = r.player === 'opp' ? 'opp' : 'self';
    const src: EffectStackEntrySource = { player };
    if (typeof r.uid === 'string') src.uid = r.uid;
    if (typeof r.cardId === 'string') src.cardId = r.cardId;
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
  } = {},
): EffectStackEntry {
  return {
    id: nextEntryId(),
    source: normalizeSource(opts.source),
    triggeredBy: { hook: opts.hook ?? 'manual', payload: opts.payload },
    triggeredAt: {
      turn: state.turn.number,
      phase: state.turn.phase,
      nano: Date.now(),
    },
    effect,
    state: 'pending',
    bindings: opts.bindings,
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
function emit(state: GameState, name: HookName, payload: unknown, source?: unknown): void {
  const list = registry.get(name);
  if (!list || list.length === 0) return;
  // スナップショット (listener が listener を解除しても列挙が壊れないように)
  const snapshot = list.slice();
  for (const listener of snapshot) {
    const result = listener(state, payload, source);
    if (result) {
      // 発火時の hook 名・payload・source を EffectStackEntry に転記する
      const entry = buildEntry(state, result, {
        hook: name,
        payload,
        source,
      });
      state.pendingEffects.push(entry);
    }
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
  entryExtras?: Pick<EffectStackEntry, 'declaredBatch' | 'declaredReaction' | 'costPaid' | 'dyn'>,
): void {
  const entry = buildEntry(state, effect, { hook: hook ?? 'manual', payload, source, bindings });
  if (entryExtras) Object.assign(entry, entryExtras);
  state.pendingEffects.push(entry);
}

/**
 * テスト用: registry を完全クリア。エントリ ID カウンタと解決ロックもリセット。
 */
function _resetRegistry(): void {
  registry.clear();
  entryIdCounter = 0;
  resolutionLocked = false;
  resolutionLockReason = null;
}

export const event = {
  on,
  emit,
  queue,
  _resetRegistry,
};
