// Phase 8 Task 8.5: ActionsPanel 操作フローのオーケストレーション
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
//
// このファイルは Task 8.1 (useEngineDispatch) + Task 8.3 (useConfirmation) を
// 組み合わせて、ActionsPanel の各ボタンが実行すべき非同期フローを提供する。
//
// Phase 8.5 では endTurn のみ実装。reasoning / action / handUseCard / nextHint /
// partnerAbility / declaredAbility / assist / solveCase は target picker や
// source unit selection を要するため Task 8.6+ で順次実装する。

import * as flow from '@/engine/flow/index.js';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction, type DispatchResult } from './useEngineDispatch.js';
import { useConfirmation } from './useConfirmation.js';
import { useTargetPicker } from './useTargetPicker.js';

type Player = 'self' | 'opp';

/** runEndTurnFlow / その他フローの返り値 */
export type FlowResult =
  | DispatchResult
  | { ok: false; reason: 'cancelled' };

/**
 * ターン終了フロー: 確認モーダル → accept で endTurn dispatch。
 *
 * - reject: { ok:false, reason:'cancelled' } (state 不変)
 * - accept: dispatchEngineAction の結果をそのまま返す
 */
export async function runEndTurnFlow(opts: { player: Player }): Promise<FlowResult> {
  const confirmation = useConfirmation();
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: 'ターン終了',
    body: 'メインフェイズを終了し、相手のターンに移行します。',
    okLabel: 'ターン終了',
    cancelLabel: '戻る',
  });
  if (!accepted) {
    return { ok: false, reason: 'cancelled' };
  }
  return dispatchEngineAction({ type: 'endTurn', player: opts.player });
}

/**
 * 推理対象の uid 候補を engine.canReason で列挙する。
 * 対象 = 自プレイヤーの partner + 自プレイヤーの scene キャラ。
 */
export function enumReasoningCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const candidates: string[] = [];
  const partnerUid = `partner:${player}`;
  if (flow.canReason(state, partnerUid)) candidates.push(partnerUid);
  for (const c of state.players[player].scene) {
    if (flow.canReason(state, c.uid)) candidates.push(c.uid);
  }
  return candidates;
}

/**
 * 推理フロー: target picker で対象選択 → confirm → reasoning dispatch。
 *
 * rules: 11-reasoning.md (active 必要、名乗り例外あり)、13-keywords.md (迅速)
 * spec: ui-action-flows.md ①推理
 *
 * - no-state / 0 候補 → 即時 abort
 * - picker cancel / confirm reject → { ok:false, reason:'cancelled' }
 * - accept → dispatchEngineAction reasoning の戻り値
 */
export async function runReasoningFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };

  const candidates = enumReasoningCandidates(state, opts.player);

  const picker = useTargetPicker();
  const chosen = await picker.start({ candidates, purpose: 'reasoning' });
  if (chosen === null) {
    return { ok: false, reason: 'cancelled' };
  }

  const confirmation = useConfirmation();
  const accepted = await confirmation.ask({
    kind: 'standard',
    title: '推理',
    body: `${chosen} で推理します。`,
    okLabel: '推理',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  return dispatchEngineAction({ type: 'reasoning', uid: chosen });
}

/**
 * ネクストヒントフロー: 確認 → FILE 最上部を手札に + 続けて使用可。
 *
 * rules: 12-next-hint.md, 17-icons.md (【FILE(X)】)
 * spec: ui-action-flows.md ⑥ネクストヒント
 *
 * - canStartNextHint=false → not-allowed
 * - reject → cancelled
 * - accept → dispatchEngineAction nextHint (optionalCardId は MVP では省略、
 *   FILE pop + nextHintUsed フラグのみ。次段で「続けて 1 枚使用」UI を実装予定)
 */
export async function runNextHintFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!flow.canStartNextHint(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const fileCount = state.players[opts.player].file.length;
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'ネクストヒント',
    body: `FILE 最上部 (現在 ${fileCount} 枚) のカードを手札に加え、続けて 1 枚使用できます。`,
    okLabel: 'ネクストヒント',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'nextHint', player: opts.player });
}

/**
 * アクション宣言フローの target identifier: opp 事件 を表す virtual uid。
 *
 * picker.candidates に通常の scene uid と混ぜて入れることで、target ピッカー上で
 * 「相手 case (事件)」を選択可能にする。実 uid と衝突しない接頭辞 'case:' を使う。
 */
export const ACTION_CASE_TARGET_OPP = 'case:opp' as const;

/**
 * source 候補列挙: アクション可能な自プレイヤーのキャラ + パートナー (rules/07)。
 *   - flow.canAction が active / 名乗り / 迅速・突撃キーワード等の全条件をカバー
 */
export function enumActionSourceCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): string[] {
  const candidates: string[] = [];
  const partnerUid = `partner:${player}`;
  if (flow.canAction(state, partnerUid)) candidates.push(partnerUid);
  for (const c of state.players[player].scene) {
    if (flow.canAction(state, c.uid)) candidates.push(c.uid);
  }
  return candidates;
}

/**
 * target 候補列挙: byUid から見たアクション対象 (rules/07)。
 *   - opp.scene の sleep/stun キャラ (canActionAgainstChar 経由で target-expander 反映)
 *   - 'case:opp' (canActionAgainstCase: opp.evidence ≥ 1)
 *
 * 注: byUid 側のプレイヤーは canActionAgainstCase が判定するため、self/opp 双方の
 * 視点で同じ列挙関数を呼べる (将来 opp ターン用に拡張する場合の互換性確保)。
 */
export function enumActionTargetCandidates(
  state: import('@/engine/types/game-state.js').GameState,
  byUid: string,
): string[] {
  const candidates: string[] = [];
  // opp 側を対象に想定 (self ターン中のアクション → 相手陣に攻撃)
  for (const c of state.players.opp.scene) {
    if (flow.canActionAgainstChar(state, byUid, c.uid)) candidates.push(c.uid);
  }
  if (flow.canActionAgainstCase(state, byUid, 'opp')) {
    candidates.push(ACTION_CASE_TARGET_OPP);
  }
  return candidates;
}

/**
 * アクション宣言フロー: source 選択 → target 選択 → 確認 → dispatch。
 *
 * rules: 07-action-flow.md / 08-contact.md / 10-action-event.md / 13-keywords.md
 * spec: ui-action-flows.md ⑤アクション
 *
 * Phase 8.7a スコープ: 相手 CPU はガード/カットイン/変装を行わない簡略実装
 * (engine の policy.applyMove と同シーケンスで FSM を端まで進める)。
 * 対話的なガード/カットイン UI は Phase 8.7b 以降で追加。
 *
 * - no-state → no-state
 * - source 候補 0 または target 候補 0 → not-allowed
 * - picker cancel / confirm reject → cancelled
 * - accept → dispatchEngineAction の結果そのまま
 */
export async function runActionFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };

  const sources = enumActionSourceCandidates(state, opts.player);
  if (sources.length === 0) return { ok: false, reason: 'not-allowed' };

  const picker = useTargetPicker();

  // 1. source 選択
  const source = await picker.start({ candidates: sources, purpose: 'action:source' });
  if (source === null) return { ok: false, reason: 'cancelled' };

  // 2. target 候補列挙 (source 確定後の state で)
  const stateAfterSrc = useGameStateStore.getState().gameState;
  if (stateAfterSrc === null) return { ok: false, reason: 'no-state' };
  const targets = enumActionTargetCandidates(stateAfterSrc, source);
  if (targets.length === 0) return { ok: false, reason: 'not-allowed' };

  // 3. target 選択
  const target = await picker.start({ candidates: targets, purpose: 'action:target' });
  if (target === null) return { ok: false, reason: 'cancelled' };

  // 4. 確認
  const isCase = target === ACTION_CASE_TARGET_OPP;
  const targetLabel = isCase ? '相手の事件' : target;
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: 'アクション',
    body: `${source} で ${targetLabel} にアクションします。`,
    okLabel: 'アクション',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };

  // 5. dispatch
  if (isCase) {
    return dispatchEngineAction({
      type: 'actionAgainstCase',
      byUid: source,
      targetPlayer: 'opp',
    });
  }
  return dispatchEngineAction({
    type: 'actionAgainstChar',
    byUid: source,
    targetUid: target,
  });
}

/**
 * 手札の使用フロー: 確認モーダル → accept → engine.handUseCard dispatch。
 *
 * rules: 05-turn-phases.md §手札の使用 (1 ターン 1 回 / ネクストヒント済不可) /
 *        20-color-and-switch.md (色制限) / 12-next-hint.md (レベル制限)
 * spec: ui-action-flows.md ①手札の使用
 *
 * - no-state → no-state
 * - canHandUseCard=false → not-allowed (色/レベル/フラグ/手札不在 全てここで弾く)
 * - reject → cancelled
 * - accept → dispatchEngineAction handUseCard
 *
 * カード効果の実体 (キャラ登場 / イベント効果) は engine の effect:declared hook と
 * Phase 5 listener が pendingEffects に積み、`runAllUntilEmpty` (dispatchEngineAction
 * 内 wrap) が解決する。本フローは「フラグ + ログ + hook emit」までの責任。
 */
export async function runHandUseFlow(opts: {
  player: Player;
  cardId: string;
}): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!flow.canHandUseCard(state, opts.player, opts.cardId)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const accepted = await useConfirmation().ask({
    kind: 'standard',
    title: '手札の使用',
    body: `${opts.cardId} を使用します。`,
    okLabel: '使用',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({
    type: 'handUseCard',
    player: opts.player,
    cardId: opts.cardId,
  });
}

/**
 * UI 側 can-check: src/ai/move-enumerator.ts canAssist と同条件。
 * ActionsPanel の disabled 表示と runAssistFlow 内 not-allowed 判定で共有する。
 */
export function canAssistForUi(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): boolean {
  const ps = state.players[player];
  if (ps.partner.state !== 'active') return false;
  if (ps.partner.location !== 'partner-area') return false;
  if (state.turnState[player].assistedThisTurn) return false;
  return true;
}

/**
 * UI 側 can-check: src/ai/move-enumerator.ts canSolveCase と同条件。
 */
export function canSolveCaseForUi(
  state: import('@/engine/types/game-state.js').GameState,
  player: Player,
): boolean {
  const ps = state.players[player];
  if (ps.case.status !== '解決編') return false;
  if (ps.evidence.length < ps.case.requiredEvidence) return false;
  if (ps.partner.state !== 'active') return false;
  if (state.turnState[player].assistedThisTurn) return false;
  return true;
}

/**
 * アシストフロー: warning モーダル → accept → mutate.partner.assist。
 *
 * rules: 13-keywords.md §アシスト / 01-victory-conditions.md §アシストしたターンは勝利できない
 * spec: ui-action-flows.md ③アシスト
 *
 * - no-state / not-allowed → reason そのまま返す (state 不変)
 * - reject → cancelled
 * - accept → dispatchEngineAction assist の戻り値
 *
 * 注: assist 後の FILE 7 枚到達 → 解決編 自動移行は engine 側 (mutate.partner.assist →
 * mutate.file.insertAssistedPartner) で処理されるため UI は気にしない。
 */
export async function runAssistFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!canAssistForUi(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const fileCount = state.players[opts.player].file.length;
  const accepted = await useConfirmation().ask({
    kind: 'warning',
    title: 'アシスト',
    body:
      `パートナーをスリープしてFILEへ移動します (現在 FILE ${fileCount} 枚 → ${fileCount + 1} 枚)。` +
      'このターン中は事件解決できなくなります。',
    okLabel: 'アシスト',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'assist', player: opts.player });
}

/**
 * 事件解決フロー: victory モーダル → accept → mutate.partner.solveCase でゲーム勝利。
 *
 * rules: 01-victory-conditions.md §事件解決
 * spec: ui-action-flows.md ④事件解決
 *
 * - no-state / not-allowed → そのまま返す
 * - reject → cancelled
 * - accept → dispatchEngineAction solveCase。`gameResult.winner` がセットされる。
 */
export async function runSolveCaseFlow(opts: { player: Player }): Promise<FlowResult> {
  const state = useGameStateStore.getState().gameState;
  if (state === null) return { ok: false, reason: 'no-state' };
  if (!canSolveCaseForUi(state, opts.player)) {
    return { ok: false, reason: 'not-allowed' };
  }
  const ps = state.players[opts.player];
  const accepted = await useConfirmation().ask({
    kind: 'victory',
    title: '事件解決 ★勝利',
    body:
      `必要証拠 ${ps.case.requiredEvidence} 件 / 現在 ${ps.evidence.length} 件。` +
      'パートナーをスリープして勝利を宣言します。',
    okLabel: '事件解決',
    cancelLabel: 'キャンセル',
  });
  if (!accepted) return { ok: false, reason: 'cancelled' };
  return dispatchEngineAction({ type: 'solveCase', player: opts.player });
}
