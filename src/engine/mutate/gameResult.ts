// engine.mutate.gameResult — ゲーム結果操作プリミティブ
// rules: 01-victory-conditions.md, 14-refresh.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type WinReason = 'evidence' | 'deck-out' | 'concede';

/**
 * ゲーム結果を設定する
 */
function set(s: GameState, winner: 'self' | 'opp', reason: WinReason): void {
  s.gameResult = { winner, reason };
}

/**
 * ゲーム結果をクリアする (テスト・リセット用)
 */
function clear(s: GameState): void {
  s.gameResult = undefined;
}

export const gameResult = {
  set,
  clear,
};
