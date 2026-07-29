// ai.replay.player — Phase 9-G.1 (replay playback)
// spec: .claude/specs/phase-9-g-replay.md
//
// 役割:
//   ReplayLog を ScriptedPolicy で再生し、runMatch で final state を再構築。
//   record と同じ initialState + 同じ move 順 → 同じ result 完全決定論的。

import type { AIPolicy } from '../policy.js';
import { runMatch, type MatchResult } from '../match.js';
import type { Move } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';
import type { ReplayLog } from './recorder.js';
import { replayNondeterminism } from './nondeterminism.js';

type Player = 'self' | 'opp';

/**
 * ScriptedPolicy — 事前記録された Move 列を順次返す決定論的 policy。
 *
 * - queue 枯渇・不正 move は replay 破損として fail closed
 * - choose 以外の optional method (chooseGuard 等) は記録されないため、
 *   replay 内で発生する場面は無し (record 時も AI が選んだ結果が move に含まれる)
 *   → optional method 未実装 (interface 契約上 OK)
 */
export class ScriptedPolicy implements AIPolicy {
  readonly name: string;
  private queue: Move[];

  constructor(name: string, moves: Move[]) {
    this.name = name;
    this.queue = [...moves];
  }

  choose(_state: GameState, candidates: Move[], _byPlayer: Player): Move | null {
    if (this.queue.length === 0) {
      throw new Error('replay move queue exhausted');
    }
    const recorded = this.queue[0];
    const legal = candidates.find((candidate) => movesEqual(candidate, recorded));
    if (!legal) {
      throw new Error(`recorded replay move is not legal: ${JSON.stringify(recorded)}`);
    }
    this.queue.shift();
    return legal;
  }

  // Replay integrity check.
  remaining(): number {
    return this.queue.length;
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function movesEqual(a: Move, b: Move): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * replayLog — 記録された log を再生し、record 時と同じ MatchResult を返す。
 *
 * Version 2 logs replay captured Math.random and Date.now values.
 * Invalid, missing, or unconsumed decisions fail closed.
 */
export function replayLog(log: ReplayLog): MatchResult {
  const selfMoves = log.moves.filter((m) => m.player === 'self').map((m) => m.move);
  const oppMoves = log.moves.filter((m) => m.player === 'opp').map((m) => m.move);

  const selfPolicy = new ScriptedPolicy('scripted-self', selfMoves);
  const oppPolicy = new ScriptedPolicy('scripted-opp', oppMoves);
  const maxTurns = log.result.reason === 'turn-cap'
    ? Math.max(0, log.result.turns - 1)
    : log.result.turns;
  let replayMoveIndex = 0;
  const run = (): MatchResult => runMatch({
    selfPolicy,
    oppPolicy,
    initialState: log.initialState,
    maxTurns,
    onTurn: (turn, player, moves) => {
      for (const move of moves) {
        const recorded = log.moves[replayMoveIndex];
        if (!recorded) {
          throw new Error(`replay emitted unexpected move at index ${replayMoveIndex}`);
        }
        if (recorded.turn !== turn) {
          throw new Error(
            `replay turn mismatch at move ${replayMoveIndex}: expected ${recorded.turn}, got ${turn}`,
          );
        }
        if (recorded.player !== player) {
          throw new Error(
            `replay player mismatch at move ${replayMoveIndex}: expected ${recorded.player}, got ${player}`,
          );
        }
        if (!movesEqual(recorded.move, move)) {
          throw new Error(`replay move mismatch at index ${replayMoveIndex}`);
        }
        replayMoveIndex += 1;
      }
    },
  });
  const result = log.schemaVersion === 2
    ? replayNondeterminism(log.nondeterminism, run)
    : run();

  if (result.winner === 'invariant-fail' && result.error?.startsWith('replay ')) {
    throw new Error(result.error);
  }
  if (selfPolicy.remaining() !== 0 || oppPolicy.remaining() !== 0) {
    throw new Error(
      `replay ended with unconsumed moves: self=${selfPolicy.remaining()} opp=${oppPolicy.remaining()}`,
    );
  }
  if (
    result.winner !== log.result.winner
    || result.reason !== log.result.reason
    || result.turns !== log.result.turns
    || (
      Object.prototype.hasOwnProperty.call(log.result, 'error')
      && result.error !== log.result.error
    )
  ) {
    throw new Error(
      `replay result mismatch: expected ${JSON.stringify(log.result)}, got ${JSON.stringify({
        winner: result.winner,
        reason: result.reason,
        turns: result.turns,
        ...(result.error !== undefined ? { error: result.error } : {}),
      })}`,
    );
  }
  return result;
}
