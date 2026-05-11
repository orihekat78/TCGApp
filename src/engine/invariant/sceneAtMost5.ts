// engine.invariant.sceneAtMost5 — 現場5枚上限の不変条件
// rules: 03-field-areas.md, 20-color-and-switch.md

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 現場のキャラ数が5枚以下であることを確認する
 * 5枚超で throw Error
 */
export function sceneAtMost5(s: GameState, p: Player): void {
  const count = s.players[p].scene.length;
  if (count > 5) {
    throw new Error(`scene at most 5: player ${p} has ${count} chars (rules/03, 20)`);
  }
}
