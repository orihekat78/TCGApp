// ai.policies.mcts-worker-pool — Phase 9-F.2 (Cleanup 6-C): MCTS 並列化 scaffold
//
// 設計:
//   - `WorkerPool` 抽象 interface: `runBatches(batches, byPlayer): Promise<number[]>`
//   - default 実装: `SequentialPool` — 同期 in-process 実行 (既存挙動と互換)
//   - 将来の `WebWorkerPool` / `NodeWorkerPool` 差替 path を type で固定
//
// 真の並列化 (Vite ?worker / worker_threads) の難易度:
//   - cards registry / engine.cards.get() は side-effect import で構築されるため、
//     worker 内で全 card def を再 register する仕組みが必要
//   - resolveEffectPicks 等が module-level state (action contexts) を持つため、
//     worker 間で衝突しない設計 (action id 名前空間分離) が必須
//
// 上記の理由で 6-C では interface のみ用意 + default sequential。
// 将来の Phase 9-F.3 で「engine の worker-safe 化」と合わせて真の並列化を実装する。

import type { GameState } from '@/engine/types';
import type { Move } from '../move-enumerator.js';

type Player = 'self' | 'opp';

/**
 * 1 rollout (= move 適用 + simulate) 単体の type。
 * iterations を batch に分割して並列実行するための単位。
 */
export type RolloutTask = {
  state: GameState;
  move: Move;
  byPlayer: Player;
  /** rollout 内で使う seed 派生用 idx (variant rollout) */
  seedIdx: number;
};

/**
 * Worker Pool 抽象。`runBatches` は同期 or 非同期で score 配列を返す。
 * 戻り値の order は input tasks の order と一致。
 */
export interface WorkerPool {
  /**
   * tasks を実行して各 task のスコア ([-1, 1]) を返す。
   * 並列実装では worker pool に分散、sequential 実装では map で順次実行。
   */
  runBatches(tasks: RolloutTask[], run: (t: RolloutTask) => number): Promise<number[]>;
}

/**
 * 同期 sequential pool (default)。既存挙動と完全互換。
 * 並列化は Phase 9-F.3 で `WebWorkerPool` を別途実装し本 interface で差替。
 */
export class SequentialPool implements WorkerPool {
  async runBatches(tasks: RolloutTask[], run: (t: RolloutTask) => number): Promise<number[]> {
    const results: number[] = new Array(tasks.length);
    for (let i = 0; i < tasks.length; i++) {
      results[i] = run(tasks[i]);
    }
    return results;
  }
}

/**
 * 簡易 worker pool factory。
 * 現状は常に SequentialPool を返す。将来 env / option で WebWorkerPool 等に切替。
 */
export function createDefaultWorkerPool(): WorkerPool {
  return new SequentialPool();
}
