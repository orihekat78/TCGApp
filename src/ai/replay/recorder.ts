// ai.replay.recorder — Phase 9-G.1 (engine-side replay recording)
// spec: .claude/specs/phase-9-g-replay.md
//
// 役割:
//   runMatch を wrap して per-move 履歴を ReplayLog に蓄積する。UI なし、純 driver layer。
//   placed in src/ai/replay/ (not engine/replay/) to avoid circular imports
//   (recordMatch depends on @/ai/match which depends on @/engine umbrella).

import { runMatch, type MatchOpts, type MatchResult } from '../match.js';
import type { Move } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

export type ReplayMove = {
  turn: number;
  player: Player;
  move: Move;
};

export type ReplayLog = {
  schemaVersion: 1;
  initialState: GameState;
  moves: ReplayMove[];
  result: {
    winner: 'self' | 'opp' | 'draw' | 'invariant-fail';
    reason: 'evidence' | 'deck-out' | 'turn-cap' | 'invariant';
    turns: number;
  };
};

/**
 * recordMatch — runMatch を wrap し、各 turn の moves を ReplayLog に蓄積する。
 *
 * 用法:
 *   const { result, log } = recordMatch({ selfPolicy, oppPolicy, initialState, ... });
 *   // log を JSON.stringify でファイル保存可
 *   const replayResult = replayLog(log); // 同じ result が再現される
 */
export function recordMatch(opts: MatchOpts): { result: MatchResult; log: ReplayLog } {
  const recordedMoves: ReplayMove[] = [];

  const wrappedOpts: MatchOpts = {
    ...opts,
    onTurn: (turnNo, player, turnMoves) => {
      for (const m of turnMoves) {
        recordedMoves.push({ turn: turnNo, player, move: m });
      }
      // caller の onTurn も呼ぶ (記録と debug 監視が両立)
      opts.onTurn?.(turnNo, player, turnMoves);
    },
  };

  const result = runMatch(wrappedOpts);

  const log: ReplayLog = {
    schemaVersion: 1,
    initialState: opts.initialState,
    moves: recordedMoves,
    result: {
      winner: result.winner,
      reason: result.reason,
      turns: result.turns,
    },
  };

  return { result, log };
}
