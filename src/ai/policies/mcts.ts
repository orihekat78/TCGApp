// ai.policies.mcts — Phase 9-F (MVP: rollout-based)
// spec: .claude/specs/phase-9-f-mcts.md
//
// 設計:
//   - 各 choose 呼び出しで candidates 各 move について N rollout (default 10)
//   - rollout = move 適用後、HeuristicPolicy × HeuristicPolicy で runMatch を gameResult まで
//   - スコア: byPlayer 勝利=+1 / 敗北=-1 / draw=0、平均最大の candidate を返却
//   - optional method (chooseGuard 等) は内部 HeuristicPolicy へ delegate
//
// Phase 9-F.2 (deferred):
//   - 真の MCTS tree (UCB1 selection / expansion / backprop)
//   - Optional method の MCTS 評価
//   - 評価関数チューニング (LP/AP/証拠 重み)
//
// 計測 baseline (Phase 9-H): per-turn avg 0.19ms / max 4.84ms
// → 100ms 予算で full-game (avg 9.85 turns) rollout は ~50 回可能
// → 10 candidates × 10 rollouts = 100 rollout × ~2ms = 200ms (やや超え)
// → MVP default rollouts=10 / candidates filter で endTurn 即返却

import type { AIPolicy } from '../policy.js';
import { playTurn, applyMove } from '../policy.js';
import type { Move } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';
import { produce } from '@/engine/produce';
import { runAllUntilEmpty } from '@/engine/resolve';
import { runMatch } from '../match.js';
import { HeuristicPolicy, type HeuristicPolicyOptions } from './heuristic.js';
import { RandomPolicy } from './random.js';
import { defaultStateEvaluator, type StateEvaluator } from './state-evaluator.js';
import { withHeadlessDecisionContext } from '../headless-decision-context.js';

type Player = 'self' | 'opp';

export interface MCTSPolicyOptions extends HeuristicPolicyOptions {
  /** 各 candidate 当たりの rollout 回数 (default 10) */
  rollouts?: number;
  /** rollout 内 maxTurns (default 30 — avg 9.85 turns の 3 倍を安全マージン) */
  rolloutMaxTurns?: number;
  /**
   * Phase 9-F.2 (Cleanup): 静的評価関数を使った partial rollout 有効化。
   * 0 (default) → full-game rollout (既存挙動)
   * N > 0 → N ターン rollout 後に evaluator で評価 (高速 + variance 低下)
   */
  evaluationTurns?: number;
  /**
   * Phase 9-F.2: 状態評価関数。default は `defaultStateEvaluator`。
   * evaluationTurns > 0 のときのみ使用。
   */
  evaluator?: StateEvaluator;
}

export class MCTSPolicy implements AIPolicy {
  readonly name = 'mcts-rollout';
  private readonly rollouts: number;
  private readonly rolloutMaxTurns: number;
  private readonly evaluationTurns: number;
  private readonly evaluator: StateEvaluator;
  private readonly heuristic: HeuristicPolicy;

  constructor(opts: MCTSPolicyOptions = {}) {
    this.rollouts = opts.rollouts ?? 10;
    this.rolloutMaxTurns = opts.rolloutMaxTurns ?? 30;
    this.evaluationTurns = opts.evaluationTurns ?? 0;
    this.evaluator = opts.evaluator ?? defaultStateEvaluator;
    this.heuristic = new HeuristicPolicy(opts);
  }

  choose(state: GameState, candidates: Move[], byPlayer: Player): Move | null {
    return withHeadlessDecisionContext(
      () => this.chooseHeadless(state, candidates, byPlayer),
    );
  }

  private chooseHeadless(state: GameState, candidates: Move[], byPlayer: Player): Move | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    // 全て endTurn なら即返却 (rollout 不要)
    if (candidates.every((c) => c.kind === 'endTurn')) return candidates[0];
    // endTurn 以外が 1 種類のみなら、それと endTurn の比較になるが MCTS で評価する価値あり

    let bestScore = -Infinity;
    let bestMove: Move = candidates[0];
    for (const c of candidates) {
      const avg = this.evaluateMove(state, c, byPlayer);
      if (avg > bestScore) {
        bestScore = avg;
        bestMove = c;
      }
    }
    return bestMove;
  }

  private evaluateMove(state: GameState, move: Move, byPlayer: Player): number {
    let total = 0;
    for (let i = 0; i < this.rollouts; i++) {
      total += this.simulate(state, move, byPlayer, i);
    }
    return total / this.rollouts;
  }

  /**
   * 1 回 rollout:
   *   1. move を applyMove で state に反映 (produce で immutable)
   *   2. runMatch で HeuristicPolicy × HeuristicPolicy を gameResult まで進める
   *   3. byPlayer 勝利 +1 / 敗北 -1 / draw or timeout 0
   *
   * Phase 9-F.2 では各 rollout で seed を変えて統計安定化する想定 (現状 fixed seed)。
   */
  private simulate(state: GameState, move: Move, byPlayer: Player, rolloutIdx: number): number {
    try {
      const afterMove = produce(state, (draft) => {
        applyMove(draft, move, byPlayer);
        runAllUntilEmpty(draft);
      });
      // gameResult が即時に決まった場合 (例: solveCase 勝利)
      if (afterMove.gameResult) {
        return scoreFor(afterMove.gameResult.winner, byPlayer);
      }
      // rollout policy は HeuristicPolicy (rolloutIdx で variant seed)
      const rolloutPolicy = new HeuristicPolicy({ seed: `mcts-rollout-${rolloutIdx}` });
      // Phase 9-F.2: evaluationTurns > 0 なら partial rollout + evaluator
      const maxTurns = this.evaluationTurns > 0 ? this.evaluationTurns : this.rolloutMaxTurns;
      const result = runMatch({
        selfPolicy: rolloutPolicy,
        oppPolicy: rolloutPolicy,
        initialState: afterMove,
        maxTurns,
      });
      if (result.winner === 'invariant-fail') return -1; // バグ扱い、保守的に敗北
      if (result.winner === 'draw') {
        // Phase 9-F.2: rollout が gameResult 未到達 (max-turn cap) なら evaluator で
        // 終端 state を評価。current state は runMatch 内部にあるため finalState は取得
        // できないが、result.finalState で公開されていれば使う。draw → 0 fallback。
        const finalState = (result as { finalState?: GameState }).finalState;
        if (this.evaluationTurns > 0 && finalState) {
          return this.evaluator(finalState, byPlayer);
        }
        return 0;
      }
      return scoreFor(result.winner, byPlayer);
    } catch {
      // applyMove 中の例外 → 保守的に敗北扱い
      return -1;
    }
  }

  // Optional methods は HeuristicPolicy へ delegate (method 形式で this.heuristic を runtime 参照)
  chooseGuard: AIPolicy['chooseGuard'] = (state, ax, candidates) =>
    this.heuristic.chooseGuard ? this.heuristic.chooseGuard(state, ax, candidates) : null;
  chooseCutIn: AIPolicy['chooseCutIn'] = (state, ax, player, candidates) =>
    this.heuristic.chooseCutIn ? this.heuristic.chooseCutIn(state, ax, player, candidates) : null;
  chooseDisguise: AIPolicy['chooseDisguise'] = (state, ax, player, candidates) =>
    this.heuristic.chooseDisguise ? this.heuristic.chooseDisguise(state, ax, player, candidates) : null;
  chooseHiramekiTrigger: AIPolicy['chooseHiramekiTrigger'] = (state, pending) =>
    this.heuristic.chooseHiramekiTrigger ? this.heuristic.chooseHiramekiTrigger(state, pending) : true;
  chooseMisreadTriggers: AIPolicy['chooseMisreadTriggers'] = (state, uid, candidates) =>
    this.heuristic.chooseMisreadTriggers ? this.heuristic.chooseMisreadTriggers(state, uid, candidates) : [];
  chooseSouzaOrder: AIPolicy['chooseSouzaOrder'] = (state, defender, cardIds) =>
    this.heuristic.chooseSouzaOrder ? this.heuristic.chooseSouzaOrder(state, defender, cardIds) : cardIds;
  chooseAtomTarget: AIPolicy['chooseAtomTarget'] = (state, verb, args, candidates, byPlayer) =>
    this.heuristic.chooseAtomTarget ? this.heuristic.chooseAtomTarget(state, verb, args, candidates, byPlayer) : null;
}

function scoreFor(winner: 'self' | 'opp' | 'draw' | 'invariant-fail', byPlayer: Player): number {
  if (winner === byPlayer) return 1;
  if (winner === 'draw' || winner === 'invariant-fail') return 0;
  return -1;
}

// playTurn / RandomPolicy import は将来拡張で使用 (現状 unused)
void playTurn;
void RandomPolicy;
