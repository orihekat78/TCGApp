// engine.resolve.* — Effect Stack
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
//
// 設計メモ:
//   - pendingEffects は EffectStackEntry[] として GameState に保持される
//   - queue() は事前構築された EffectStackEntry を push するだけ
//     (Effect → Entry のラップは event.queue / event.buildEntry が担当)
//   - next() は rules/25 の解決順を適用:
//       1. state==='pending' のみ
//       2. ターンプレイヤー > 非ターンプレイヤー
//       3. 同所有者の全未解決効果内: ownerChosenOrder 昇順 (undefined は最後)
//       4. tiebreaker: pendingEffects 配列の挿入順
//   - runOne() は resolveGuard を解決直前に再評価 (rules/25 「〜してもよい」)
//   - runAllUntilEmpty は最大 1000 件で安全弁 (無限ループ防止)
//   - lock/unlock/isLocked は module-level (event/registry.ts の _setResolutionLock 経由)

import type {
  GameState,
  EffectStackEntry,
  Effect,
  EffectCtx,
} from '../types/index.js';
import { run as runEffect } from '../effect/resolver.js';
import { isDeclaredNameValidForEffect } from '../effect/declared-name-domain.js';
import { evalCond } from '../cond/eval.js';
import { _getResolutionLock, _setResolutionLock, event } from '../event/registry.js';
import { _resolveReasoningContinuation } from '../flow/main/reasoning.js';
import { _continueTurnTransition } from '../flow/turn.js';
import {
  clearPersistedPendingRuntimeState,
  hydratePendingRuntimeState,
  persistPendingRuntimeState,
  resetPendingRuntimeStateAfterGameEnd,
} from '../effect/runtime-state.js';
import { _peekPendingDeckPlaceSide, _peekPendingDeckReorderSide } from '../effect/atom-handlers/_shared.js';
import {
  _peekPendingEffectChoiceSide,
  _peekPendingEffectOptionalSide,
  _peekPendingEffectPickSide,
  _peekPendingEffectRepeatOptionalSide,
  _peekPendingChooseInterceptSide,
  _peekPendingRpsSide,
  _peekPendingSetCardChoiceSide,
  _peekPendingSetCardReplacementSide,
} from '../effect/pending-state.js';
import { _peekPendingHirameki } from '../listeners/hirameki.js';
import { _peekPendingMisread } from '../listeners/misread.js';
import {
  cloneCausalEffectTrace,
  completeEffectCausalTrace,
  ensureEffectCausalTrace,
  withStructuredCausalResolution,
} from '../log/effect-causal.js';

const SAFETY_CAP = 1000;
// A resolver continuation may invoke runAllUntilEmpty more than once on the same
// Immer draft. Remember that this exact live authority already reached terminal
// state so a second entry cannot erase the completed presentation FIFO. A loaded
// or cloned terminal GameState has a different identity and still hard-clears.
const ACTIVE_TERMINAL_PRESENTATION_STATES = new WeakSet<object>();

function cancelPendingAfterGameEnd(
  state: GameState,
  options: { preserveCompletedPresentations: boolean },
): void {
  for (const entry of state.pendingEffects) {
    if (entry.state === 'pending' || entry.state === 'resolving') entry.state = 'cancelled';
  }
  delete state.pendingTurnTransition;
  delete state.pendingReasoningContinuation;
  delete state.pendingMisreadAuthority;
  state.reservedEffects = [];
  clearPersistedPendingRuntimeState(state);
  resetPendingRuntimeStateAfterGameEnd(options);
  if (options.preserveCompletedPresentations) ACTIVE_TERMINAL_PRESENTATION_STATES.add(state);
  else ACTIVE_TERMINAL_PRESENTATION_STATES.delete(state);
}

function hasPendingDecisionExceptPick(): boolean {
  return Boolean(
    _peekPendingEffectChoiceSide()
    || _peekPendingEffectOptionalSide()
    || _peekPendingEffectRepeatOptionalSide()
    || _peekPendingChooseInterceptSide()
    || _peekPendingRpsSide()
    || _peekPendingSetCardChoiceSide()
    || _peekPendingSetCardReplacementSide()
    || _peekPendingDeckReorderSide()
    || _peekPendingDeckPlaceSide()
    || _peekPendingHirameki()
    || _peekPendingMisread(),
  );
}

// BUG-132 GAP-2 (2026-06-12): declaredReaction entry の pick/dyn を解決時に substitute する
// resolver。実体は listener 層 (listeners/triggered.ts resolveDeferredEntryPicks) が
// _setDeferredEntryPickResolver で注入する — stack コアから @/ai への依存を作らないため
// (敵対レビュー impl/regression lens 反映)。未注入時は raw effect をそのまま実行 (従来挙動)。
type DeferredEntryPickResolver = (state: GameState, entry: EffectStackEntry, ctx: EffectCtx) => Effect;
let _deferredEntryPickResolver: DeferredEntryPickResolver | null = null;

export function _setDeferredEntryPickResolver(fn: DeferredEntryPickResolver | null): void {
  _deferredEntryPickResolver = fn;
}

/**
 * Build an EffectCtx from an entry's source + trigger payload. Resolver-only
 * helper. Card abilities that need richer context should pass their own
 * EffectCtx via direct engine.effect.run calls.
 */
export function effectCtxFromStackEntry(entry: EffectStackEntry): EffectCtx {
  if (entry.causalTrace !== undefined && entry.causalCorrelationEventId !== undefined) {
    throw new Error('causal trace and child correlation are mutually exclusive');
  }
  // BUG-104: cutin の contact binding を ctx.contact に展開する。D11013 custom check は
  // ctx.contact.targetUid (コンタクト相手) を読んで「警察か」を判定するが、従来 ctx.contact 未設定で
  // 永久 false (1ドロー不発) だった。bindings.contact は cutIn (flow/contact.ts) が詰める。
  const cb = (entry.bindings as Record<string, unknown[]> | undefined)?.['contact']?.[0] as
    | { byUid?: string; targetUid?: string; guardUid?: string; attackerSide?: 'self' | 'opp' }
    | undefined;
  return {
    source: {
      player: entry.source.player,
      area: entry.source.area ?? 'scene',
      cardId: entry.source.cardId,
      uid: entry.source.uid,
      abilityId: entry.source.abilityId,
      resolutionKind: entry.source.resolutionKind,
      triggerBatch: entry.triggerBatch,
      ownerChosenOrder: entry.ownerChosenOrder,
      ownerOrderConfirmed: entry.ownerOrderConfirmed,
      ...(entry.declaredBatch !== undefined ? { declaredBatch: entry.declaredBatch } : {}),
    },
    // 2026-05-27 (Option C follow-up): entry.bindings に queue 時点の値があれば復元。
    // `$contact.byUid` 等の bind ref が atom-handler 実行時に正しく解決されるよう保証。
    // entry.bindings の値は Candidate[] とは限らない (例: contact bindings は
    // 任意 object array) ため、resolveBindRef 内の `as Record<string, unknown>` cast
    // で読み出される。型レベルでは Record<string, Candidate[]> として渡す (cast 必要)。
    // engine mega-wave W4 (2026-07-03, r83): shallow-copy — entry は state.pendingEffects 内 =
    // Immer 凍結。runAtom preamble の pick-bind writeback (ctx.bindings[bind] 書込) が
    // "object is not extensible" で落ちるため、runtime ctx はコピーに切り離す (読取は従来同値)。
    bindings: { ...(entry.bindings ?? {}) } as EffectCtx['bindings'],
    triggerPayload: entry.triggeredBy.payload,
    // engine additive wave (2026-06-29d): queue 時点の costPaid を復元 (bindings と同型)。
    // costRemovedMatches cond (宣言能力 conditional の STABLE `if` runtime 再評価) が cost 除去カード
    // snapshot を読むため。不在時は省略 (従来挙動)。
    ...(entry.costPaid ? { costPaid: entry.costPaid } : {}),
    // BUG-171 (2026-07-04): queue 時点の dyn を復元 (costPaid と同型)。declaredName 供給チャネル
    // (atomDeclareName / resolveBindRef '$dyn.*') の queue-boundary 喪失修正。entry は Immer 凍結 =
    // runtime の (ctx.dyn ??= {}) 書込 (chainStepNoApply 等) が落ちないよう shallow-copy (bindings 同 posture)。
    ...(entry.dyn ? { dyn: { ...entry.dyn } } : {}),
    ...(entry.publicHandRevealToken || entry.causalTrace || entry.causalCorrelationEventId
      ? {
          causal: {
            ...(entry.publicHandRevealToken ? { publicHandRevealToken: entry.publicHandRevealToken } : {}),
            ...(entry.causalTrace ? { trace: cloneCausalEffectTrace(entry.causalTrace) } : {}),
            ...(entry.causalCorrelationEventId ? { correlationEventId: entry.causalCorrelationEventId } : {}),
          },
        }
      : {}),
    ...(cb
      ? { contact: { byUid: cb.byUid ?? '', targetUid: cb.targetUid, guardUid: cb.guardUid, attackerSide: cb.attackerSide ?? 'self' } }
      : {}),
  };
}

/**
 * Push an entry into pendingEffects. Callers (event.queue / event.emit /
 * card listeners) already provide a fully built entry.
 */
export function queue(state: GameState, entry: EffectStackEntry): void {
  state.pendingEffects.push(entry);
}

function isDeclaredReactionEligible(
  entry: EffectStackEntry,
  pending: Array<{ entry: EffectStackEntry; idx: number }>,
): boolean {
  if (entry.declaredReaction === undefined) return true;
  if (entry.declaredBatch !== undefined
    && pending.some(other =>
      other.entry !== entry
      && other.entry.declaredBatch === entry.declaredBatch
      && other.entry.declaredReaction === undefined)) return false;
  return true;
}

/**
 * Determine the next entry to resolve, per rules/15 + rules/25.
 * Returns null if no pending entry exists.
 */
export function next(state: GameState): EffectStackEntry | null {
  const turnPlayer = state.turn.player;
  // Build (entry, originalIndex) pairs to keep insertion order as tiebreaker.
  const pending: { entry: EffectStackEntry; idx: number }[] = [];
  state.pendingEffects.forEach((e, i) => {
    if (e.state === 'pending') pending.push({ entry: e, idx: i });
  });
  if (pending.length === 0) return null;

  // BUG-132 GAP-2: 第三者反応 (declaredReaction) は「使用したイベントの効果を先に解決します」
  // (B08020 公式Q&A、rules/15 §未解決) を満たすまで選択不可。pairwise gate であり、それ以外の
  // entry 間の所有者任意順 (ownerChosenOrder, rules/15 §未解決) には影響しない (敵対レビュー反映)。
  // block 条件 (いずれか):
  //   (i)  同 batch の own entry (非反応) が pending — 自効果がまだ解決されていない
  //   (ii) own (イベント) 由来の未解決 pick/choice/optional が engine 側 channel に残存 —
  //        human modal 解決前に反応の候補を確定させない (解決は次 dispatch の runAllUntilEmpty で再開)
  //   (iii) own 由来の follow-up entry (choice-option 再開等、source.cardId 一致・非反応) が pending
  // own が cancelled (無効化) になった場合は gate が外れ、発動済みの反応は解決される (rules/24 §発動済)。
  const gated = pending.filter(({ entry }) => {
    if (entry.reasoningContinuation !== undefined) {
      return !pending.some(other => other.entry !== entry && other.entry.reasoningContinuation === undefined);
    }
    if (entry.declaredReaction === undefined) return true;
    // (i) 同 batch の own entry が pending
    if (entry.declaredBatch !== undefined
      && pending.some(o =>
        o.entry !== entry
        && o.entry.declaredBatch === entry.declaredBatch
        && o.entry.declaredReaction === undefined)) return false;
    return true;
  });
  // 反応のみが残存 = own の modal 解決待ち。null を返して drain を終了し、modal 解決後の
  // 次 dispatch (applyPick/Choice/OptionalAndContinuation → runAllUntilEmpty) で再評価される。
  if (gated.length === 0) return null;

  gated.sort((a, b) => {
    // 1. A carrier created after a human decision is still the effect that was
    // already resolving. Finish it before any trigger emitted by its prefix.
    const ar = a.entry.resumesCurrentEffect === true ? 0 : 1;
    const br = b.entry.resumesCurrentEffect === true ? 0 : 1;
    if (ar !== br) return ar - br;
    // 2. Turn player first.
    const ap = a.entry.source.player === turnPlayer ? 0 : 1;
    const bp = b.entry.source.player === turnPlayer ? 0 : 1;
    if (ap !== bp) return ap - bp;
    // 3. The owner orders all unresolved effects, regardless of activation
    // order or emission batch (rules/15). Batch remains provenance only.
    const ao = a.entry.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    const bo = b.entry.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    // 4. Stable insertion order before the owner makes an explicit choice.
    return a.idx - b.idx;
  });
  return gated[0].entry;
}

/** All currently eligible unresolved effects owned by the priority human. */
export function pendingOwnerOrderGroup(
  state: GameState,
  human: 'self' | 'opp' | null,
): EffectStackEntry[] {
  if (human === null) return [];
  const upcoming = next(state);
  if (!upcoming || upcoming.source.player !== human) return [];
  if (upcoming.resumesCurrentEffect === true || upcoming.reasoningContinuation !== undefined) return [];
  const pending = state.pendingEffects
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => entry.state === 'pending');
  const group = state.pendingEffects.filter((entry) =>
    entry.state === 'pending'
    && entry.resumesCurrentEffect !== true
    && entry.reasoningContinuation === undefined
    && entry.source.player === human
    && isDeclaredReactionEligible(entry, pending),
  );
  if (group.length < 2 || group.every((entry) => entry.ownerOrderConfirmed === true)) return [];
  return group.sort((a, b) => {
    const ao = a.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    const bo = b.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return state.pendingEffects.indexOf(a) - state.pendingEffects.indexOf(b);
  });
}

/**
 * Resolve one entry:
 *   1. state -> 'resolving' + emit effect:resolve:start
 *   2. resolveGuard が false なら 'cancelled' して return
 *      (cancel した場合は effect:resolve:end は emit しない)
 *   3. ctx を作って engine.effect.run を呼ぶ
 *   4. state -> 'resolved' + emit effect:resolve:end
 *
 * 効果が対象0で実質何も起きなくても "fired" 扱い (rules/24)。
 *
 * Hook 仕様 (spec: engine-api-events.md):
 *   - effect:resolve:start { effectId } — 解決開始時
 *   - effect:resolve:end   { effectId } — 解決終了時 (resolved 状態に遷移後)
 */
export function runOne(state: GameState, entry: EffectStackEntry): void {
  if (state.gameResult !== undefined) {
    cancelPendingAfterGameEnd(state, {
      preserveCompletedPresentations: ACTIVE_TERMINAL_PRESENTATION_STATES.has(state),
    });
    return;
  }
  if (!isDeclaredNameValidForEffect(entry.effect, entry.dyn?.declaredName)) {
    entry.state = 'cancelled';
    return;
  }
  const parentBatch = state.effectTriggerBatchContext;
  const parentConfirmed = state.effectTriggerBatchConfirmedContext;
  state.effectTriggerBatchContext = entry.triggerBatch;
  state.effectTriggerBatchConfirmedContext = entry.ownerOrderConfirmed;
  try {
    const ctx = effectCtxFromStackEntry(entry);
    const trace = ensureEffectCausalTrace(state, ctx);
    if (trace) entry.causalTrace = cloneCausalEffectTrace(trace);
    let guardRejected = false;
    withStructuredCausalResolution(state, () => {
      entry.state = 'resolving';
      event.emit(state, 'effect:resolve:start', { effectId: entry.id }, entry.source);
      if (entry.resolveGuard !== undefined) {
        const ok = evalCond(state, entry.resolveGuard, ctx);
        if (!ok) {
          entry.state = 'cancelled';
          guardRejected = true;
          return;
        }
      }
      if (entry.reasoningContinuation !== undefined) {
        _resolveReasoningContinuation(state, entry.reasoningContinuation, trace);
      } else {
        // Candidate substitution happens only when this entry is actually reached.
        const effectToRun = (entry.declaredReaction !== undefined || entry.deferredPicks === true) && _deferredEntryPickResolver !== null
          ? _deferredEntryPickResolver(state, entry, ctx)
          : entry.effect;
        runEffect(state, effectToRun, ctx);
      }
      entry.state = 'resolved';
      event.emit(state, 'effect:resolve:end', { effectId: entry.id }, entry.source);
    }, trace);
    if (trace) entry.causalTrace = cloneCausalEffectTrace(trace);
    completeEffectCausalTrace(
      state,
      trace,
      entry.source.player,
      guardRejected ? 'cancel' : 'summary',
      guardRejected
        ? { type: 'state', state: 'cancelled' }
        : { type: 'state', state: 'success' },
    );
    if (trace) entry.causalTrace = cloneCausalEffectTrace(trace);
  } finally {
    if (parentBatch === undefined) delete state.effectTriggerBatchContext;
    else state.effectTriggerBatchContext = parentBatch;
    if (parentConfirmed === undefined) delete state.effectTriggerBatchConfirmedContext;
    else state.effectTriggerBatchConfirmedContext = parentConfirmed;
  }
}

/**
 * Drain the stack until no pending entries remain. New entries queued
 * during resolution are picked up automatically (rules/15 "未解決").
 * Safety cap: 1000 iterations.
 */
export function runAllUntilEmpty(
  state: GameState,
  options: { preserveCompletedPresentationsOnTerminalEntry?: boolean } = {},
): void {
  if (state.gameResult !== undefined) {
    cancelPendingAfterGameEnd(state, {
      preserveCompletedPresentations: options.preserveCompletedPresentationsOnTerminalEntry === true
        || ACTIVE_TERMINAL_PRESENTATION_STATES.has(state),
    });
    return;
  }
  hydratePendingRuntimeState(state);
  for (let i = 0; i < SAFETY_CAP; i++) {
    if (state.gameResult !== undefined) {
      cancelPendingAfterGameEnd(state, { preserveCompletedPresentations: true });
      return;
    }
    const e = next(state);
    // A human decision is a hard resolution boundary. Do not let a sibling
    // stack entry overtake it or overwrite a single-slot side channel. A
    // just-selected pick may still run its own `effect:pick-resolved` entry
    // while a later FIFO pick is waiting.
    if (hasPendingDecisionExceptPick()) {
      persistPendingRuntimeState(state);
      return;
    }
    const pendingPick = _peekPendingEffectPickSide();
    if (e === null) {
      if (pendingPick) {
        persistPendingRuntimeState(state);
        return;
      }
      if (_continueTurnTransition(state)) continue;
      clearPersistedPendingRuntimeState(state);
      return;
    }
    if (
      pendingPick?.source.triggerBatch !== undefined
      && e.triggeredBy.hook !== 'effect:pick-resolved'
    ) {
      persistPendingRuntimeState(state);
      return;
    }
    if (shouldPauseForOwnerOrder(state, e)) {
      clearPersistedPendingRuntimeState(state);
      return;
    }
    runOne(state, e);
  }
  // Provide the last-seen entry's details for debuggability (Phase 4+ scenarios).
  const last = next(state);
  const lastId = last?.id ?? 'n/a';
  const lastCardId = last?.source.cardId ?? 'n/a';
  const lastHook = last?.triggeredBy.hook ?? 'n/a';
  throw new Error(
    `engine.resolve.runAllUntilEmpty: 1000-iter safety cap exceeded — possible infinite loop. Last entry: id=${lastId} cardId=${lastCardId} hook=${lastHook}`,
  );
}

function shouldPauseForOwnerOrder(state: GameState, upcoming: EffectStackEntry): boolean {
  const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
  const group = pendingOwnerOrderGroup(state, human);
  return group.length >= 2 && group.some((entry) => entry.id === upcoming.id);
}

/**
 * Mark an entry cancelled by id (no-op if missing or not pending).
 * Used by "〜を無効にする" effects (rules/15 即時例外).
 */
export function cancel(state: GameState, entryId: string): void {
  const entry = state.pendingEffects.find(e => e.id === entryId);
  if (!entry) return;
  if (entry.state === 'pending') {
    entry.state = 'cancelled';
  }
}

/**
 * Replace the Effect on a pending entry (id-keyed).
 * Used by "代わりに〜" effects (rules/15 即時例外).
 *
 * @see Effect.kind='replace' — the user-facing DSL "代わりに" form (Effect Descriptor)
 *   which is an *immediate-resolution* effect; it is forbidden to pass a `replace`
 *   Effect directly to `engine.effect.run`. The two concepts are distinct:
 *   Effect.kind='replace' describes *what* to do, engine.resolve.replace *does it*.
 */
export function replace(state: GameState, entryId: string, newEffect: Effect): void {
  const entry = state.pendingEffects.find(e => e.id === entryId);
  if (!entry) return;
  if (entry.state === 'pending') {
    entry.effect = newEffect;
  }
}

/**
 * Snapshot of pendingEffects regardless of state — for UI / debug.
 * Returns a shallow copy of the array (entries themselves are shared).
 */
export function peek(state: GameState): EffectStackEntry[] {
  return state.pendingEffects.slice();
}

export function lock(_state: GameState, reason: string): void {
  _setResolutionLock(true, reason);
}

export function unlock(_state: GameState): void {
  _resetResolutionLock();
}

/** Match-session boundary reset for module-owned resolution state. */
export function _resetResolutionLock(): void {
  _setResolutionLock(false, null);
}

export function isLocked(_state: GameState): boolean {
  return _getResolutionLock().locked;
}
