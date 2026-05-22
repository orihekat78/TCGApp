// Phase 9-F.2 (Cleanup 6-C) — WorkerPool scaffold tests

import { describe, it, expect } from 'vitest';
import { SequentialPool, createDefaultWorkerPool, type RolloutTask } from '@/ai/policies/mcts-worker-pool';

describe('mcts-worker-pool', () => {
  it('createDefaultWorkerPool returns SequentialPool', () => {
    const pool = createDefaultWorkerPool();
    expect(pool).toBeInstanceOf(SequentialPool);
  });

  it('SequentialPool runs tasks in order and preserves results', async () => {
    const pool = new SequentialPool();
    const tasks: RolloutTask[] = [
      { state: {} as never, move: { kind: 'endTurn' }, byPlayer: 'self', seedIdx: 0 },
      { state: {} as never, move: { kind: 'endTurn' }, byPlayer: 'self', seedIdx: 1 },
      { state: {} as never, move: { kind: 'endTurn' }, byPlayer: 'self', seedIdx: 2 },
    ];
    const results = await pool.runBatches(tasks, (t) => t.seedIdx * 0.1);
    expect(results).toEqual([0, 0.1, 0.2]);
  });

  it('SequentialPool returns empty array for empty input', async () => {
    const pool = new SequentialPool();
    const results = await pool.runBatches([], () => 0);
    expect(results).toEqual([]);
  });
});
