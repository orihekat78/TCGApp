// ai.match — AI vs AI single-match driver (Phase 6 Group C Task 6.5)
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 05-turn-phases.md (3 フェイズ), 01-victory-conditions.md (勝利条件),
//        04-game-setup.md (敗北条件 — リフレッシュ時 remove 0 枚)
//
// 設計メモ:
//   - runMatch は initialState (setup 済み・auto-phase 済み) を受け取り、
//     ゲーム終了 (gameResult が set される) or turn-cap まで turn-by-turn で進行
//   - 各ターン:
//       1. policy.playTurn → メインフェイズの行動を全て適用
//       2. engine.flow.endTurn → エンドフェイズ → ターン番号 / プレイヤー切替
//       3. engine.resolve.runAllUntilEmpty → ターン終了時 trigger 解消
//       4. engine.flow.runAutoPhase(nextPlayer) → 次ターンのオートフェイズ
//       5. engine.mutate.flag.resetTurnFlags(currentPlayer) → ターンフラグリセット
//         (注: engine.flow.endTurn は flag リセットを行わない — Phase 4 設計)
//   - try/catch でループを包み、エンジン bug / invariant 違反を 'invariant-fail' で受ける
//   - movesPerTurn に各ターンの move 数を記録 (debug 用)

import type { GameState } from '@/engine/types';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { playTurn, type AIPolicy } from './policy.js';
import type { Move } from './move-enumerator.js';
import { withIsolatedPendingRuntimeState } from '@/engine/effect/runtime-state.js';
import { withHeadlessDecisionContext } from './headless-decision-context.js';

type Player = 'self' | 'opp';

export type MatchResult = {
  winner: 'self' | 'opp' | 'draw' | 'invariant-fail';
  reason: 'evidence' | 'deck-out' | 'turn-cap' | 'invariant';
  turns: number;
  /** moves per turn (debug; index 0 = turn 1) */
  movesPerTurn: number[];
  finalState: GameState;
  /** populated when winner === 'invariant-fail' */
  error?: string;
  /**
   * Phase 9-H: profile=true 時の per-turn 経過 ms (playTurn のみ、endTurn / autoPhase 除外)。
   * `MatchOpts.profile` が false (default) なら undefined。
   */
  turnDurationsMs?: number[];
};

export type MatchOpts = {
  selfPolicy: AIPolicy;
  oppPolicy: AIPolicy;
  /** initial state — must already be setup-complete (decideFirstPlayer/reveal/startGame)
   *  AND have auto-phase already run for state.turn.player. */
  initialState: GameState;
  /** max turns before declaring draw (default 100) */
  maxTurns?: number;
  /** optional hook for streaming per-turn moves (debug) */
  onTurn?: (turnNo: number, byPlayer: Player, moves: Move[]) => void;
  /**
   * Phase 9-H: per-turn 計測を有効化。true で `MatchResult.turnDurationsMs` に
   * playTurn 経過時間 (ms) を push する。default false (overhead ゼロ)。
   */
  profile?: boolean;
};

const DEFAULT_MAX_TURNS = 100;

/**
 * runMatch — Drive an AI vs AI match to completion or turn cap.
 *
 * Behavior:
 *   - state は initialState の clone (Immer 経由)
 *   - 各ターンで:
 *       * 現在のプレイヤーの policy を選択
 *       * playTurn で main フェイズの全 move 適用 (内部で resolve も回す)
 *       * gameResult が決まったら終了
 *       * endTurn → resolve → 反対プレイヤーで runAutoPhase → resetTurnFlags
 *   - turn.number > maxTurns で 'draw'/'turn-cap'
 *   - 例外 / invariant 違反は 'invariant-fail' で捕捉
 */
export function runMatch(opts: MatchOpts): MatchResult {
  return withHeadlessDecisionContext(() =>
    withIsolatedPendingRuntimeState(opts.initialState, () => runIsolatedMatch(opts)));
}

function runIsolatedMatch(opts: MatchOpts): MatchResult {
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  let state = opts.initialState;
  const movesPerTurn: number[] = [];
  // Phase 9-H: profile=true 時のみ allocate (default は undefined のまま zero-overhead)
  const turnDurationsMs: number[] | undefined = opts.profile ? [] : undefined;

  try {
    while (!state.gameResult && state.turn.number <= maxTurns) {
      const currentPlayer = state.turn.player;
      const policy = currentPlayer === 'self' ? opts.selfPolicy : opts.oppPolicy;
      const turnNo = state.turn.number;

      // 1. メインフェイズ: policy にターンを駆動させる
      const tStart = turnDurationsMs ? performance.now() : 0;
      const { moves, finalState: afterPlay } = playTurn(state, policy, currentPlayer);
      if (turnDurationsMs) turnDurationsMs.push(performance.now() - tStart);
      state = afterPlay;
      movesPerTurn.push(moves.length);
      opts.onTurn?.(turnNo, currentPlayer, moves);

      // gameResult が確定したらすぐ終了 (endTurn を回す必要なし)
      if (state.gameResult) break;

      // turn-cap チェック (playTurn 内で turn.number が変わることはない)
      if (state.turn.number > maxTurns) break;

      // 2. エンドフェイズ → ターン交替
      state = produce(state, draft => {
        engine.flow.endTurn(draft, currentPlayer, { startNextTurn: true });
        // End triggers, cleanup, transfer, and the next auto phase are one
        // serializable continuation (rules/05).
        engine.resolve.runAllUntilEmpty(draft);
      });

      // gameResult が trigger 解消で決まった可能性がある
      if (state.gameResult) break;

      // turn.number > maxTurns になっていれば draw 扱い
      if (state.turn.number > maxTurns) break;

      // オートフェイズ中のドローやリフレッシュで gameResult が決まる可能性
      if (state.gameResult) break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      winner: 'invariant-fail',
      reason: 'invariant',
      turns: state.turn.number,
      movesPerTurn,
      finalState: state,
      error: msg,
      turnDurationsMs,
    };
  }

  // 終了判定
  if (state.gameResult) {
    return {
      winner: state.gameResult.winner,
      // 'concede' (現状 partner.solveCase 経由は 'evidence') / 'deck-out' / 'evidence' / 'alt-lose'
      // MatchResult.reason は 'evidence' | 'deck-out' | 'turn-cap' | 'invariant' に絞る。
      // 'alt-lose' (engine E3「相手はゲームに敗北する」) は勝敗結果としては証拠勝利と同区分 → 'evidence' に写す。
      reason:
        state.gameResult.reason === 'concede' || state.gameResult.reason === 'alt-lose'
          ? 'evidence'
          : state.gameResult.reason,
      turns: state.turn.number,
      movesPerTurn,
      finalState: state,
      turnDurationsMs,
    };
  }

  // turn-cap reached
  return {
    winner: 'draw',
    reason: 'turn-cap',
    turns: state.turn.number,
    movesPerTurn,
    finalState: state,
    turnDurationsMs,
  };
}
