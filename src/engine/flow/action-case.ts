// engine.flow.actionCase — アクション[事件] 処理 (Phase 4 Group B Task 4.6)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 07-action-flow.md, 10-action-event.md
//
// 提供 API:
//   - removeOpponentEvidenceTop: 相手証拠最上部1枚を取り出し → リムーブ
//                                + evidence:remove-by-action emit (ヒラメキ判定窓)
//   - flashWindow:               (Phase 4 stub — Phase 5 ヒラメキ targeting で実装)
//   - gainSelfEvidence:          自分の証拠+1 (LP無関係) — byUid 不在でも進める

import type { GameState, ActionContext, EvidenceCard } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';

type Player = 'self' | 'opp';

/**
 * removeOpponentEvidenceTop — 相手証拠最上部1枚をリムーブ
 *
 * - mutate.evidence.removeTop が証拠 → リムーブエリア へ移動 (rules/10)
 * - evidence:remove-by-action emit (spec: { player, ev })
 * - 戻り値: 取り出した EvidenceCard (なければ undefined)
 *
 * 注意: spec では「ヒラメキ判定窓」はこの Hook で発火させ、別途 flashWindow で
 *       具体的なヒラメキ処理 (Phase 5) を行う設計。
 */
export function removeOpponentEvidenceTop(
  state: GameState,
  ax: ActionContext,
): EvidenceCard | undefined {
  if (ax.target.kind !== 'case') {
    throw new Error('flow.actionCase.removeOpponentEvidenceTop: target is not case');
  }
  const player: Player = ax.target.player;
  const ev = mutate.evidence.removeTop(state, player);
  if (!ev) return undefined;

  // evidence:remove-by-action emit (spec: { player, ev })
  event.emit(
    state,
    'evidence:remove-by-action',
    { player, ev },
    { player: ax.byPlayer, uid: ax.byUid },
  );

  return ev;
}

/**
 * flashWindow — ヒラメキ判定窓 (Phase 4 stub)
 *
 * Phase 5 でヒラメキ持ち判定 → 相手選択 → 効果解決 → リムーブ の流れを実装。
 * 現状はログ追記のみ。
 *
 * @param ev   リムーブ対象の証拠カード
 * @param owner 証拠の所有者 (リムーブされた側 = ヒラメキ発動可能側)
 */
export function flashWindow(
  state: GameState,
  ev: EvidenceCard,
  owner: Player,
): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: owner,
    turn: state.turn.number,
    action: 'flash-window-stub',
    target: ev.cardId,
    result: 'phase5-pending',
  });
}

/**
 * gainSelfEvidence — 自分のデッキから1枚を裏向きで証拠エリアに追加 (rules/10)
 *
 * - 1枚固定 (攻撃キャラの LP に依存しない)
 * - byUid が現場を離れていても、ここまでは進める (rules/10)
 */
export function gainSelfEvidence(state: GameState, ax: ActionContext): void {
  const p: Player = ax.byPlayer;
  mutate.evidence.addFromDeck(state, p, 1, false, {
    turn: state.turn.number,
    via: 'action-case',
  });
  // ログ
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'action-case-gain',
    result: '+1',
  });
}

export const actionCase = {
  removeOpponentEvidenceTop,
  flashWindow,
  gainSelfEvidence,
};
