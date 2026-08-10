// ai.replay.recorder — Phase 9-G.1 (engine-side replay recording)
// spec: .claude/specs/phase-9-g-replay.md
//
// 役割:
//   runMatch を wrap して per-move 履歴を ReplayLog に蓄積する。UI なし、純 driver layer。
//   placed in src/ai/replay/ (not engine/replay/) to avoid circular imports
//   (recordMatch depends on @/ai/match which depends on @/engine umbrella).

import { runMatch, type MatchOpts, type MatchResult } from '../match.js';
import type { AIPolicy } from '../policy.js';
import type { Move } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';
import { captureNondeterminism, type ReplayNondeterminism } from './nondeterminism.js';
import type { ReplayLogV3 } from './state-frame.js';

type Player = 'self' | 'opp';

export type ReplayMove = {
  turn: number;
  player: Player;
  move: Move;
};

type ReplayResult = {
  winner: 'self' | 'opp' | 'draw' | 'invariant-fail';
  reason: 'evidence' | 'deck-out' | 'turn-cap' | 'invariant';
  turns: number;
  error?: string;
};

export type ReplayLogV1 = {
  schemaVersion: 1;
  initialState: GameState;
  moves: ReplayMove[];
  result: ReplayResult;
};

export type ReplayLogV2 = {
  schemaVersion: 2;
  initialState: GameState;
  moves: ReplayMove[];
  result: ReplayResult;
  nondeterminism: ReplayNondeterminism;
};

export type LegacyReplayLog = ReplayLogV1 | ReplayLogV2;
export type ReplayLog = LegacyReplayLog | ReplayLogV3;

function isolatePolicyNondeterminism(
  policy: AIPolicy,
  withoutCapture: <T>(run: () => T) => T,
): AIPolicy {
  return new Proxy(policy, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => withoutCapture(
        () => Reflect.apply(value, target, args),
      );
    },
  });
}

/**
 * recordMatch — runMatch を wrap し、各 turn の moves を ReplayLog に蓄積する。
 *
 * 用法:
 *   const { result, log } = recordMatch({ selfPolicy, oppPolicy, initialState, ... });
 *   // log を JSON.stringify でファイル保存可
 *   const replayResult = replayLog(log); // 同じ result が再現される
 */
export function recordMatch(opts: MatchOpts): { result: MatchResult; log: ReplayLogV2 } {
  const recordedMoves: ReplayMove[] = [];
  const initialState = structuredClone(opts.initialState);
  let runWithoutCapture = <T>(run: () => T): T => run();

  const wrappedOpts: MatchOpts = {
    ...opts,
    selfPolicy: isolatePolicyNondeterminism(
      opts.selfPolicy,
      (run) => runWithoutCapture(run),
    ),
    oppPolicy: isolatePolicyNondeterminism(
      opts.oppPolicy,
      (run) => runWithoutCapture(run),
    ),
    onTurn: (turnNo, player, turnMoves) => {
      for (const m of turnMoves) {
        recordedMoves.push({
          turn: turnNo,
          player,
          move: structuredClone(m),
        });
      }
      // caller の onTurn も呼ぶ (記録と debug 監視が両立)
      // Defer observers so their clock/RNG reads do not enter the engine trace.
      runWithoutCapture(() => opts.onTurn?.(turnNo, player, turnMoves));
    },
  };

  const { value: result, trace } = captureNondeterminism((scope) => {
    runWithoutCapture = scope.withoutCapture;
    return runMatch(wrappedOpts);
  });

  const log: ReplayLogV2 = {
    schemaVersion: 2,
    initialState,
    moves: recordedMoves,
    nondeterminism: trace,
    result: {
      winner: result.winner,
      reason: result.reason,
      turns: result.turns,
      ...(result.error !== undefined ? { error: result.error } : {}),
    },
  };

  return { result, log };
}
