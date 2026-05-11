// engine.flow.main.usePartnerAbility — パートナー能力使用 (rules/05 03.)
// rules: 06-card-types.md (パートナーは active のみ行動可), 21-declared-ability-cost.md
//
// Phase 4 境界:
//   - canPartnerAbility は active 状態 + 位置チェック
//   - usePartnerAbility は flag/log + effect:declared hook の emit のみ
//   - 実際の能力 Effect 実行は Phase 5 のカード登録で listener が pendingEffects に積む

import type { GameState } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';

type Player = 'self' | 'opp';

/**
 * canPartnerAbility — パートナー能力使用可能か判定する。
 *
 * - パートナーがアクティブ状態
 * - パートナーが partner-area にいる (file-area / mr-removed は不可)
 *
 * abilId 単位の細かい条件 (【ターン①】等) はカード固有 listener で判定する想定。
 */
export function canPartnerAbility(state: GameState, p: Player, _abilId: string): boolean {
  const partner = state.players[p].partner;
  if (!partner.cardId) return false;
  if (partner.state !== 'active') return false;
  if (partner.location !== 'partner-area') return false;
  return true;
}

/**
 * usePartnerAbility — パートナー能力使用を宣言する。
 *
 * - effect:declared を emit (cost / 効果は listener 側で処理)
 * - ログ追加
 */
export function usePartnerAbility(
  state: GameState,
  p: Player,
  abilId: string,
  _ctx?: unknown,
): void {
  if (!canPartnerAbility(state, p, abilId)) {
    throw new Error(`usePartnerAbility: not allowed for ${p} abilId=${abilId}`);
  }
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'partnerAbility',
    target: abilId,
  });
  event.emit(
    state,
    'effect:declared',
    { kind: 'partnerAbility', abilId },
    { player: p, cardId: state.players[p].partner.cardId },
  );
}
