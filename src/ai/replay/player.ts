// ai.replay.player — Phase 9-G.1 (replay playback)
// spec: .claude/specs/phase-9-g-replay.md
//
// 役割:
//   ReplayLog を ScriptedPolicy で再生し、runMatch で final state を再構築。
//   record と同じ initialState + 同じ move 順 → 同じ result 完全決定論的。

import type { AIPolicy } from '../policy.js';
import { runMatch, type MatchResult } from '../match.js';
import type { Move } from '../move-enumerator.js';
import type { GameState, ActionContext } from '@/engine/types';
import type { ReplayLog } from './recorder.js';

type Player = 'self' | 'opp';

/**
 * ScriptedPolicy — 事前記録された Move 列を順次返す決定論的 policy。
 *
 * - queue 空になった場合は candidates 内の endTurn を選ぶ (safety)
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
      // queue 切れ: 安全策として endTurn を返す (replay 終了)
      return candidates.find((c) => c.kind === 'endTurn') ?? candidates[0] ?? null;
    }
    return this.queue.shift() ?? null;
  }

  // queue 残量 (debug 用)
  remaining(): number {
    return this.queue.length;
  }
}

// optional method の型を unused-suppress
void ({} as ActionContext);

/**
 * replayLog — 記録された log を再生し、record 時と同じ MatchResult を返す。
 *
 * 注意:
 *   - 記録時と同じ Math.random seed を caller 側で設定する必要あり
 *     (engine 内部の deck shuffle / autoPhase が確率的なため)
 *   - maxTurns は log.result.turns + 5 (safety margin)
 */
export function replayLog(log: ReplayLog): MatchResult {
  const selfMoves = log.moves.filter((m) => m.player === 'self').map((m) => m.move);
  const oppMoves = log.moves.filter((m) => m.player === 'opp').map((m) => m.move);

  return runMatch({
    selfPolicy: new ScriptedPolicy('scripted-self', selfMoves),
    oppPolicy: new ScriptedPolicy('scripted-opp', oppMoves),
    initialState: log.initialState,
    maxTurns: log.result.turns + 5,
  });
}
