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
//       3. 同所有者内: ownerChosenOrder 昇順 (undefined は最後)
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
import { evalCond } from '../cond/eval.js';
import { _getResolutionLock, _setResolutionLock, event } from '../event/registry.js';

const SAFETY_CAP = 1000;

/**
 * Build an EffectCtx from an entry's source + trigger payload. Resolver-only
 * helper. Card abilities that need richer context should pass their own
 * EffectCtx via direct engine.effect.run calls.
 */
function entryToCtx(entry: EffectStackEntry): EffectCtx {
  // BUG-104: cutin の contact binding を ctx.contact に展開する。D11013 custom check は
  // ctx.contact.targetUid (コンタクト相手) を読んで「警察か」を判定するが、従来 ctx.contact 未設定で
  // 永久 false (1ドロー不発) だった。bindings.contact は cutIn (flow/contact.ts) が詰める。
  const cb = (entry.bindings as Record<string, unknown[]> | undefined)?.['contact']?.[0] as
    | { byUid?: string; targetUid?: string; guardUid?: string; attackerSide?: 'self' | 'opp' }
    | undefined;
  return {
    source: {
      player: entry.source.player,
      area: 'scene',
      cardId: entry.source.cardId,
      uid: entry.source.uid,
    },
    // 2026-05-27 (Option C follow-up): entry.bindings に queue 時点の値があれば復元。
    // `$contact.byUid` 等の bind ref が atom-handler 実行時に正しく解決されるよう保証。
    // entry.bindings の値は Candidate[] とは限らない (例: contact bindings は
    // 任意 object array) ため、resolveBindRef 内の `as Record<string, unknown>` cast
    // で読み出される。型レベルでは Record<string, Candidate[]> として渡す (cast 必要)。
    bindings: (entry.bindings ?? {}) as EffectCtx['bindings'],
    triggerPayload: entry.triggeredBy.payload,
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

  pending.sort((a, b) => {
    // 1. Turn player first.
    const ap = a.entry.source.player === turnPlayer ? 0 : 1;
    const bp = b.entry.source.player === turnPlayer ? 0 : 1;
    if (ap !== bp) return ap - bp;
    // 2. ownerChosenOrder ascending; undefined treated as +Infinity.
    const ao = a.entry.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    const bo = b.entry.ownerChosenOrder ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    // 3. Tiebreaker: insertion order.
    return a.idx - b.idx;
  });
  return pending[0].entry;
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
  entry.state = 'resolving';
  event.emit(state, 'effect:resolve:start', { effectId: entry.id }, entry.source);
  const ctx = entryToCtx(entry);
  if (entry.resolveGuard !== undefined) {
    const ok = evalCond(state, entry.resolveGuard, ctx);
    if (!ok) {
      entry.state = 'cancelled';
      return;
    }
  }
  runEffect(state, entry.effect, ctx);
  entry.state = 'resolved';
  event.emit(state, 'effect:resolve:end', { effectId: entry.id }, entry.source);
}

/**
 * Drain the stack until no pending entries remain. New entries queued
 * during resolution are picked up automatically (rules/15 "未解決").
 * Safety cap: 1000 iterations.
 */
export function runAllUntilEmpty(state: GameState): void {
  for (let i = 0; i < SAFETY_CAP; i++) {
    const e = next(state);
    if (e === null) return;
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
  _setResolutionLock(false, null);
}

export function isLocked(_state: GameState): boolean {
  return _getResolutionLock().locked;
}
