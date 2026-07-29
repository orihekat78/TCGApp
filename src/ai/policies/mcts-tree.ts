// ai.policies.mcts-tree — Phase 9-F.2 (Cleanup 6-B): UCB1 tree-based MCTS
//
// spec: .claude/specs/phase-9-f-mcts.md (Out of Scope: UCB1 tree → 本 Phase で導入)
//
// 設計:
//   - Node = { state, parent, children[], visits, wins, untriedMoves[] }
//   - 4 phase per iteration:
//     1. Selection: root から UCB1 で最大値の child を辿る
//     2. Expansion: untriedMoves が残っていれば 1 つ展開して new child
//     3. Simulation: 新 node から HeuristicPolicy で rollout、evaluator で score
//     4. Backpropagation: score を全 ancestor の visits/wins に加算
//   - 反復回数 (iterations) 経過後、root の最高 visits の child を返却
//
// 既存 MCTSPolicy (rollout-based) との違い:
//   - rollout-based: 各 candidate を均等 N rollout 評価 (sample 配分固定)
//   - UCB1 tree: 有望な分岐に sample を集中 (exploration vs exploitation balance)
//
// 計測:
//   - per-iteration: applyMove + rollout (with cap maxTurns)
//   - default iterations=200, maxTurns=10 → 1 choose() あたり ~150ms 想定
//
// Phase 9-F.2 残: 並列化 (worker pool) は 6-C で対応

import type { AIPolicy } from '../policy.js';
import { applyMove } from '../policy.js';
import type { Move } from '../move-enumerator.js';
import { enumerateMoves } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';
import { produce } from '@/engine/produce';
import { runAllUntilEmpty } from '@/engine/resolve';
import { runMatch } from '../match.js';
import { HeuristicPolicy, type HeuristicPolicyOptions } from './heuristic.js';
import { defaultStateEvaluator, type StateEvaluator } from './state-evaluator.js';
import { withHeadlessDecisionContext } from '../headless-decision-context.js';

type Player = 'self' | 'opp';

export interface MCTSTreePolicyOptions extends HeuristicPolicyOptions {
  /** root から計算する MCTS iteration 回数 (default 200) */
  iterations?: number;
  /** rollout の最大ターン数 (default 10、評価関数で leaf eval) */
  rolloutMaxTurns?: number;
  /** UCB1 の exploration 係数 C (default √2 ≈ 1.414) */
  ucbC?: number;
  /** 状態評価関数 (default `defaultStateEvaluator`) */
  evaluator?: StateEvaluator;
}

interface MCTSNode {
  state: GameState;
  parent: MCTSNode | null;
  /** parent からこの node へ至る move (root では null) */
  moveFromParent: Move | null;
  /** この node の手番プレイヤー (selection 時に視点を区別する用) */
  toMove: Player;
  visits: number;
  /** この node 以下の rollout で byPlayer (root.toMove) が獲得した累計 score */
  totalScore: number;
  children: MCTSNode[];
  untriedMoves: Move[];
}

function createNode(
  state: GameState,
  toMove: Player,
  parent: MCTSNode | null,
  moveFromParent: Move | null,
): MCTSNode {
  return {
    state,
    parent,
    moveFromParent,
    toMove,
    visits: 0,
    totalScore: 0,
    children: [],
    untriedMoves: enumerateMoves(state, toMove),
  };
}

function ucb1Score(child: MCTSNode, parentVisits: number, c: number): number {
  if (child.visits === 0) return Infinity;
  const exploit = child.totalScore / child.visits;
  const explore = c * Math.sqrt(Math.log(parentVisits) / child.visits);
  return exploit + explore;
}

function selectChild(node: MCTSNode, c: number): MCTSNode {
  let best = node.children[0];
  let bestScore = -Infinity;
  for (const child of node.children) {
    const s = ucb1Score(child, node.visits, c);
    if (s > bestScore) {
      bestScore = s;
      best = child;
    }
  }
  return best;
}

export class MCTSTreePolicy implements AIPolicy {
  readonly name = 'mcts-tree-ucb1';
  private readonly iterations: number;
  private readonly rolloutMaxTurns: number;
  private readonly ucbC: number;
  private readonly evaluator: StateEvaluator;
  private readonly heuristic: HeuristicPolicy;
  private readonly heuristicOpts: HeuristicPolicyOptions;

  constructor(opts: MCTSTreePolicyOptions = {}) {
    this.iterations = opts.iterations ?? 200;
    this.rolloutMaxTurns = opts.rolloutMaxTurns ?? 10;
    this.ucbC = opts.ucbC ?? Math.sqrt(2);
    this.evaluator = opts.evaluator ?? defaultStateEvaluator;
    this.heuristic = new HeuristicPolicy(opts);
    this.heuristicOpts = opts;
  }

  choose(state: GameState, candidates: Move[], byPlayer: Player): Move | null {
    return withHeadlessDecisionContext(
      () => this.chooseHeadless(state, candidates, byPlayer),
    );
  }

  private chooseHeadless(state: GameState, candidates: Move[], byPlayer: Player): Move | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    if (candidates.every((m) => m.kind === 'endTurn')) return candidates[0];

    const root = createNode(state, byPlayer, null, null);
    // candidates が enumerateMoves の subset であることを尊重し、root の untriedMoves を
    // candidates に絞る (caller が allowlist で制限している場合)
    root.untriedMoves = candidates.slice();

    for (let i = 0; i < this.iterations; i++) {
      this.runIteration(root, byPlayer, i);
    }

    // 最も visits 多い child を採用 (robust child)
    let best = root.children[0];
    let bestVisits = -1;
    for (const child of root.children) {
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
        best = child;
      }
    }
    return best?.moveFromParent ?? candidates[0];
  }

  /** 1 iteration: select → expand → simulate → backpropagate */
  private runIteration(root: MCTSNode, rootPlayer: Player, idx: number): void {
    // 1. Selection: untried が無くなる or terminal まで child を辿る
    let node = root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node, this.ucbC);
    }

    // 2. Expansion: untried が残っていれば 1 つ展開
    if (node.untriedMoves.length > 0) {
      const moveIdx = Math.floor(idx % node.untriedMoves.length);
      const move = node.untriedMoves.splice(moveIdx, 1)[0];
      try {
        const childState = produce(node.state, (draft) => {
          applyMove(draft, move, node.toMove);
          runAllUntilEmpty(draft);
        });
        const childToMove: Player = move.kind === 'endTurn'
          ? (node.toMove === 'self' ? 'opp' : 'self')
          : node.toMove;
        const child = createNode(childState, childToMove, node, move);
        node.children.push(child);
        node = child;
      } catch {
        // applyMove 例外 → この iteration は skip (move は untried から除外済)
        return;
      }
    }

    // 3. Simulation: node から rollout、leaf state を evaluator で評価
    const score = this.simulate(node, rootPlayer, idx);

    // 4. Backpropagation: 全 ancestor に score 加算
    let cur: MCTSNode | null = node;
    while (cur !== null) {
      cur.visits += 1;
      cur.totalScore += score;
      cur = cur.parent;
    }
  }

  private simulate(node: MCTSNode, rootPlayer: Player, idx: number): number {
    if (node.state.gameResult) {
      return node.state.gameResult.winner === rootPlayer ? 1 : -1;
    }
    try {
      const rolloutPolicy = new HeuristicPolicy({
        ...this.heuristicOpts,
        seed: `mcts-tree-${idx}`,
      });
      const result = runMatch({
        selfPolicy: rolloutPolicy,
        oppPolicy: rolloutPolicy,
        initialState: node.state,
        maxTurns: this.rolloutMaxTurns,
      });
      if (result.winner === 'invariant-fail') return -1;
      if (result.winner === 'draw') {
        const finalState = (result as { finalState?: GameState }).finalState;
        if (finalState) return this.evaluator(finalState, rootPlayer);
        return 0;
      }
      return result.winner === rootPlayer ? 1 : -1;
    } catch {
      return -1;
    }
  }

  // Optional methods は HeuristicPolicy へ delegate
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
