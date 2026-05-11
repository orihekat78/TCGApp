// engine.read.log — ログセレクタ (純粋関数)
// rules: 05-turn-phases.md

import type { GameState, LogEntry } from '@/engine/types';

// 末尾 n 件取得
function tail(s: GameState, n: number): LogEntry[] {
  if (n <= 0) return [];
  return s.log.slice(-n);
}

// 特定ターン番号のログ
function byTurn(s: GameState, turnNo: number): LogEntry[] {
  return s.log.filter(e => e.turn === turnNo);
}

// 特定プレイヤーのログ
function byPlayer(s: GameState, p: 'self' | 'opp'): LogEntry[] {
  return s.log.filter(e => e.player === p);
}

// 述語でフィルタリング
function search(s: GameState, predicate: (e: LogEntry) => boolean): LogEntry[] {
  return s.log.filter(predicate);
}

export const log = {
  tail,
  byTurn,
  byPlayer,
  search,
};
