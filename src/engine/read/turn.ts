// engine.read.turn — ターン情報セレクタ (純粋関数)
// rules: 05-turn-phases.md, 04-game-setup.md

import type { GameState, TurnScopedFlags, TurnSnapshot } from '@/engine/types';

function current(s: GameState): TurnSnapshot {
  return s.turn;
}

function player(s: GameState): 'self' | 'opp' {
  return s.turn.player;
}

function opponent(s: GameState): 'self' | 'opp' {
  return s.turn.player === 'self' ? 'opp' : 'self';
}

function phase(s: GameState): 'auto' | 'main' | 'end' {
  return s.turn.phase;
}

function number(s: GameState): number {
  return s.turn.number;
}

function isFirstPlayerFirstTurn(s: GameState): boolean {
  return s.turn.isFirstPlayerFirstTurn;
}

function flags(s: GameState, p: 'self' | 'opp'): TurnScopedFlags {
  return s.turnState[p];
}

export const turn = {
  current,
  player,
  opponent,
  phase,
  number,
  isFirstPlayerFirstTurn,
  flags,
};
