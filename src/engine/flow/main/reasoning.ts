// engine.flow.main.doReasoning — 推理 (rules/05 05., rules/11)
//
// 概要:
//   1. アクティブな自キャラ (or パートナー) を 1 体選択
//   2. スリープ化
//   3. デッキ最上部から LP 枚を裏向きで証拠エリアに追加
//      - LP ≤ 0 の場合は 0 枚 (rules/11)
//
// 制限:
//   - 名乗り状態 (isNamed) は推理不可 (rules/11)
//   - 例外: 迅速 持ちは名乗り状態でも推理可 (rules/13)
//   - スリープ / スタンは推理不可
//
// Phase 4 境界:
//   - reasoning:declare → reasoning:after-sleep → reasoning:before-add → reasoning:end Hook を emit
//   - LP は read.char.lp で取得 (override 反映済み)
//   - 証拠加算は mutate.evidence.addFromDeck で行う
//   - mislead 等は Phase 5 で reasoning:before-add listener として実装される
//     → Phase 4 は emit のみ、解決待機状態を作らない (呼出元が runAllUntilEmpty を回す)

import type { CausalEffectTrace, GameState, SceneCharacter, PartnerOnBoard, ReasoningContinuation } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { char as readChar } from '../../read/char.js';
import { _peekPendingMisread } from '../../listeners/misread.js';
import {
  cloneCausalEffectTrace,
  completeEffectCausalTrace,
  markEffectCausalAwaitingResume,
  recordCausalTraceOperation,
  startStandaloneCausalTrace,
  withEffectCausalCorrelation,
  withStructuredCausalResolution,
} from '../../log/effect-causal.js';

/**
 * uid から対象を探す。パートナーは "partner:self" / "partner:opp" の形式で扱う。
 */
function findTarget(
  state: GameState,
  uid: string,
): { kind: 'char'; char: SceneCharacter; player: 'self' | 'opp' } |
   { kind: 'partner'; partner: PartnerOnBoard; player: 'self' | 'opp' } | null {
  // partner:self / partner:opp 形式の判定
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p = uid === 'partner:self' ? 'self' : 'opp';
    return { kind: 'partner', partner: state.players[p].partner, player: p };
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find(c => c.uid === uid);
    if (c) return { kind: 'char', char: c, player: p };
  }
  return null;
}

/**
 * canReason — 推理可能か判定する。
 *
 * - 対象キャラ / パートナーが存在
 * - active 状態
 * - キャラの場合: 名乗りなし or 迅速持ち (rules/11, 13)
 * - パートナーの場合: 名乗り状態の概念なし (rules/06) → active なら常に可
 */
export function canReason(state: GameState, uid: string): boolean {
  const t = findTarget(state, uid);
  if (!t) return false;
  if (t.kind === 'partner') {
    return t.partner.state === 'active';
  }
  // char
  if (t.char.state !== 'active') return false;
  if (readChar.selfContinuousFlag(state, uid, 'selfReasonBan')) return false;
  // engine additive wave-8 (2026-07-02, P15): 「このキャラは推理できない。」付与 (B09072 a2、
  // ターン終了時まで)。charSetTurnEffect verb が turnEffects['cannotReason']=true を立て、
  // clearTurnEffects('turn') が endTurn で削除。付与は名乗り/迅速に優先する絶対制限 (rules/11:
  // 推理は名乗り/状態と独立の行動可否)。既存カードは本キーを立てない → 挙動不変。
  if (t.char.turnEffects['cannotReason'] === true) return false;
  if (t.char.isNamed) {
    // 名乗り状態: 迅速持ちのみ可
    return readChar.hasKeyword(state, uid, '迅速');
  }
  return true;
}

/**
 * パートナーの LP を CardDef から取得する (Phase 4 簡易版)
 *   - Phase 5 で read.partner.lp 等の整備時に置き換え予定
 */
function clearReasoningLpModifier(
  target: { kind: 'char'; char: SceneCharacter } | { kind: 'partner'; partner: PartnerOnBoard },
): void {
  if (target.kind === 'char') {
    delete target.char.turnEffects['lpMod_reasoning'];
    return;
  }
  if (target.partner.turnEffects) delete target.partner.turnEffects['lpMod_reasoning'];
}

/**
 * doReasoning — 推理を実行する。
 *
 * - reasoning:declare → スリープ化 → reasoning:after-sleep → reasoning:before-add → 証拠追加 → reasoning:end
 * - LP は max(0, lp) で証拠枚数を決定 (rules/11)
 *
 * Phase 4 注意:
 *   - reasoning:after-sleep の任意効果後、reasoning:before-add で mislead 等が listener として LP を下げる Effect を
 *     queue する想定。Phase 4 は Hook 発火のみ — 解決は呼出元が runAllUntilEmpty を実行。
 *   - LP 取得は emit 後の現時点の状態を参照する (発火→pendingに積まれる)。
 *     Phase 5 で listener を 即時解決 (replace/直接 LP 修正) に切替できるよう設計。
 */
export function doReasoning(state: GameState, uid: string): void {
  if (!canReason(state, uid)) {
    throw new Error(`doReasoning: not allowed for uid=${uid}`);
  }
  const t = findTarget(state, uid)!;
  const player = t.player;
  const causalTrace = startStandaloneCausalTrace(state, {
    actor: player,
    kind: 'declare',
    source: t.kind === 'char'
      ? { kind: 'scene-card', side: player, uid }
      : { kind: 'partner-card', side: player },
    targets: [{ kind: 'zone', side: player, zone: 'evidence' }],
    outcome: { type: 'state', state: 'active' },
  });

  // reasoning:declare — spec: { uid, byPlayer }
  withEffectCausalCorrelation(state, causalTrace?.rootEventId, () => {
    event.emit(state, 'reasoning:declare', { uid, byPlayer: player }, { player, uid });
  });

  // スリープ化
  if (t.kind === 'char') {
    mutate.scene.setState(state, uid, 'sleep');
  } else {
    mutate.partner.setState(state, player, 'sleep');
  }
  recordCausalTraceOperation(state, causalTrace, {
    actor: player,
    kind: 'sleep',
    source: { kind: 'player', side: player },
    targets: t.kind === 'char'
      ? [{ kind: 'scene-card', side: player, uid }]
      : [{ kind: 'partner-card', side: player }],
    outcome: { type: 'state', state: 'sleep' },
  });

  // This window is before both mislead and evidence. Its continuation waits
  // for every card reaction (including a human optional discard) to finish.
  withEffectCausalCorrelation(state, causalTrace?.rootEventId, () => {
    event.emit(state, 'reasoning:after-sleep', { uid, player }, { player, uid });
  });
  const token = (state.reasoningContinuationSeq ?? 0) + 1;
  state.reasoningContinuationSeq = token;
  const continuation: ReasoningContinuation = { token, uid, player };
  state.pendingReasoningContinuation = continuation;
  event.queue(
    state,
    { kind: 'atom', verb: 'noop', args: {} },
    { player, uid },
    'reasoning:after-sleep:continue',
    { uid, player },
    undefined,
    {
      reasoningContinuation: continuation,
      ...(causalTrace
        ? { causalTrace: cloneCausalEffectTrace(causalTrace), resumesCurrentEffect: true }
        : {}),
    },
  );
}

/** @internal Resolver-only continuation. The GameState token is single-use. */
export function _resolveReasoningContinuation(
  state: GameState,
  continuation: ReasoningContinuation,
  causalTrace?: CausalEffectTrace,
): void {
  const pending = state.pendingReasoningContinuation;
  if (
    pending?.token !== continuation.token
    || pending.uid !== continuation.uid
    || pending.player !== continuation.player
  ) {
    throw new Error('reasoning continuation: invalid or consumed token');
  }
  const target = findTarget(state, continuation.uid);
  // An after-sleep reaction can legally switch/remove the reasoner itself.
  // The exact state-owned token still authenticates this continuation; when
  // its original target no longer exists, reasoning ends here without the
  // before-add window, evidence, log, or reasoning:end hook.
  if (!target) {
    delete state.pendingReasoningContinuation;
    completeEffectCausalTrace(
      state,
      causalTrace,
      continuation.player,
      'cancel',
      { type: 'state', state: 'cancelled' },
    );
    return;
  }
  if (target.player !== continuation.player || (target.kind === 'char' ? target.char.state : target.partner.state) !== 'sleep') {
    throw new Error('reasoning continuation: target is not the sleeping reasoner');
  }
  delete state.pendingReasoningContinuation;
  _continueReasoningAfterSleep(state, continuation.uid, continuation.player, causalTrace);
}

/** Runs only after all reasoning:after-sleep reactions have settled. */
export function _continueReasoningAfterSleep(
  state: GameState,
  uid: string,
  player: 'self' | 'opp',
  causalTrace?: CausalEffectTrace,
): void {
  // reasoning:before-add — spec: { uid, lpUsed } (lpUsed は pre-clamp 生値 — mislead listener が参照)
  const lpRaw = readChar.lp(state, uid);
  event.emit(state, 'reasoning:before-add', { uid, lpUsed: lpRaw }, { player, uid });

  // Human defender がミスリードを決めるまで、証拠取得と
  // reasoning:end は保留する。先に発火すると他の human decision と二重になる。
  const pendingMisread = _peekPendingMisread();
  if (
    pendingMisread?.reasoningUid === uid &&
    pendingMisread.reasoningPlayer === player
  ) {
    pendingMisread.causalTrace = cloneCausalEffectTrace(causalTrace);
    markEffectCausalAwaitingResume(causalTrace);
    return;
  }

  completeReasoning(state, uid, player, causalTrace);
}

/** Human のミスリード決定後に、保留した推理後半を実行する。 */
export function _resumeDeferredReasoning(
  state: GameState,
  uid: string,
  player: 'self' | 'opp',
  causalTrace?: CausalEffectTrace,
): void {
  completeReasoning(state, uid, player, causalTrace);
  completeEffectCausalTrace(state, causalTrace, player);
}

function completeReasoning(
  state: GameState,
  uid: string,
  player: 'self' | 'opp',
  causalTrace?: CausalEffectTrace,
): void {
  const t = findTarget(state, uid);
  if (!t || t.player !== player) {
    throw new Error(`completeReasoning: missing target uid=${uid} player=${player}`);
  }

  // Phase 8 完全クローズ Commit 3b: emit 後の LP を再読み (mislead listener が
  // turnEffects.lpMod_turn 等で LP を下げた可能性がある)。
  try {
    const lpFinal = readChar.lp(state, uid);
    const evidenceSuppressed = t.kind === 'char'
      && t.char.turnEffects['suppressReasoningEvidence'] === true;
    // LP クランプ → max(0, lpFinal) 枚を証拠に追加 (rules/11)
    const lpToUse = evidenceSuppressed ? 0 : Math.max(0, lpFinal);
    const gainEvidence = (): number => mutate.evidence.addFromDeck(state, player, lpToUse, false, {
      turn: state.turn.number,
      via: 'reasoning',
      sourceCardId: t.kind === 'char' ? t.char.cardId : t.partner.cardId,
    });
    const evidenceGained = lpToUse <= 0
      ? 0
      : causalTrace === undefined
        ? gainEvidence()
        : withStructuredCausalResolution(state, gainEvidence, causalTrace);

    // ログ + reasoning:end
    recordCausalTraceOperation(state, causalTrace, {
      actor: player,
      kind: 'evidence',
      source: t.kind === 'char'
        ? { kind: 'scene-card', side: player, uid }
        : { kind: 'partner-card', side: player },
      targets: [{ kind: 'zone', side: player, zone: 'evidence' }],
      outcome: { type: 'count', amount: evidenceGained, unit: 'evidence' },
    });
    if (causalTrace === undefined) {
      mutate.log.append(state, {
        ts: Date.now(),
        player,
        turn: state.turn.number,
        action: 'reasoning',
        target: uid,
        result: `evidence+${evidenceGained}`,
      });
    }
    withEffectCausalCorrelation(state, causalTrace?.rootEventId, () => {
      event.emit(state, 'reasoning:end', { uid, player, gained: evidenceGained }, { player, uid });
    });
  } finally {
    if (t.kind === 'char') delete t.char.turnEffects['suppressReasoningEvidence'];
    clearReasoningLpModifier(t);
  }
}
