// engine.flow.main.useDeclaredAbility — 宣言能力使用 (rules/05 04.)
// rules: 21-declared-ability-cost.md, 17-icons.md (【ターン①/②】), 24-qa-naming-stun.md
//
// 重要 (rules/21, 24):
//   - 名乗り状態でも宣言能力は使用可能 (例外)
//   - active 状態である必要はない (ただし sleep コストは sleep キャラには支払えない)
//   - 【ターン①/②】は declaredUseCount[abilId] で管理 (rules/15)
//
// Phase 4 境界:
//   - canDeclaredAbility は対象キャラ存在 + 回数制限のみ判定
//   - useDeclaredAbility は flag/log + effect:declared hook の emit のみ
//   - cost は呼出元の responsibility (engine.cost.canPay/pay を ctx に渡す)
//   - 実際の Effect 実行は Phase 5 のカード登録で listener が pendingEffects に積む

import type { GameState } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';

/**
 * findSceneChar — 場のキャラを uid で探す
 */
function findSceneChar(state: GameState, uid: string): { player: 'self' | 'opp'; cardId: string } | null {
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find(c => c.uid === uid);
    if (c) return { player: p, cardId: c.cardId };
  }
  return null;
}

/**
 * 宣言能力の【ターン①/②】判定。
 *   - Phase 4 では maxPerTurn を引数で受けず、abilId が登録時に持つ前提で
 *     エンジン側はカウントの読み取りのみ提供する。
 *   - 呼出元 (UI / カードリスナ) が `engine.read.char.declaredUseCount` を見て
 *     上限超過なら canDeclaredAbility=false を返すよう拡張可能。
 *   - 暫定: useCount の参照を提供するのみ。
 */

/**
 * canDeclaredAbility — 宣言能力使用可能か判定する。
 *
 * - 対象キャラが存在する
 * - 名乗り状態でも OK (rules/24)
 * - active でなくても OK (ただし sleep コストは支払不可なため別途 engine.cost.canPay 判定が必要)
 * - 【ターン①/②】チェックは listener の responsibility (Phase 5)
 */
export function canDeclaredAbility(state: GameState, uid: string, _abilId: string): boolean {
  return findSceneChar(state, uid) !== null;
}

/**
 * useDeclaredAbility — 宣言能力使用を宣言する。
 *
 * - declaredUseCount[abilId] をインクリメント
 * - effect:declared を emit
 * - ログ追加
 *
 * cost 支払いは呼出元の responsibility (Phase 4 は分離).
 */
export function useDeclaredAbility(
  state: GameState,
  uid: string,
  abilId: string,
  _ctx?: unknown,
): void {
  const found = findSceneChar(state, uid);
  if (!found) {
    throw new Error(`useDeclaredAbility: char uid=${uid} not in scene`);
  }
  mutate.flag.incrDeclaredUseCount(state, uid, abilId);
  mutate.log.append(state, {
    ts: Date.now(),
    player: found.player,
    turn: state.turn.number,
    action: 'declaredAbility',
    target: `${uid}:${abilId}`,
  });
  event.emit(
    state,
    'effect:declared',
    { kind: 'declaredAbility', uid, abilId },
    { player: found.player, uid, cardId: found.cardId },
  );
}
