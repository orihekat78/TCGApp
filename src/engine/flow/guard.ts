// engine.flow.guard — ガード判定 (Phase 4 Group B Task 4.7)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 07-action-flow.md, 13-keywords.md (ブレット), 24-qa-naming-stun.md (名乗りOK)
//
// 仕様:
//   - candidates: 防御側 (相手側) の active キャラ。名乗り状態 OK。AP条件なし
//   - 攻撃側が ブレット を持つ場合 candidates は [] (ガード不可)
//   - canGuard: 攻撃側ブレット判定 + 候補判定

import type { GameState } from '../types/index.js';
import { char as readChar } from '../read/char.js';

type Player = 'self' | 'opp';

/**
 * findActorPlayer: byUid から攻撃側プレイヤーを判定
 *  - partner:self/opp 対応
 *  - 通常キャラは scene からスキャン
 */
function findActorPlayer(state: GameState, uid: string): Player | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some(c => c.uid === uid)) return p;
  }
  return null;
}

/**
 * candidates — ガード候補
 *
 * 攻撃側 (byUid) に対し、防御側プレイヤー (反対側) の **active** キャラ全員を返す。
 * 名乗り状態 OK (rules/24)、AP条件なし (rules/07)。
 * ⚠ 攻撃側が ブレット を持つ場合 [] を返す (ガード不可)。
 */
export function candidates(
  state: GameState,
  byUid: string,
): { uid: string; cardId: string }[] {
  // 攻撃側ブレット判定 (rules/13)
  if (byUid !== 'partner:self' && byUid !== 'partner:opp') {
    if (readChar.hasKeyword(state, byUid, 'ブレット')) {
      return [];
    }
  }
  // パートナーキャラのブレット判定は Phase 5 で読み出し API を拡張する想定
  // (現状 read.char はキャラのみ対象なので、partner uid の場合は ブレットチェックを skip)

  const attackerSide = findActorPlayer(state, byUid);
  if (!attackerSide) return [];
  const defenderSide: Player = attackerSide === 'self' ? 'opp' : 'self';

  return state.players[defenderSide].scene
    .filter(c => c.state === 'active')
    .map(c => ({ uid: c.uid, cardId: c.cardId }));
}

/**
 * canGuard — guardUid がガードできるか
 *
 * - 攻撃側がブレットなら false
 * - guardUid が候補リストに含まれていれば true
 */
export function canGuard(state: GameState, byUid: string, guardUid: string): boolean {
  const list = candidates(state, byUid);
  return list.some(c => c.uid === guardUid);
}

export const guard = {
  candidates,
  canGuard,
};
