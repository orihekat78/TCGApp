// ゲームログ操作テスト
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { log } from '@/engine/mutate/log';
import type { LogEntry } from '@/engine/types';

const baseEntry: LogEntry = {
  ts: 1000,
  player: 'self',
  turn: 1,
  action: 'reasoning',
  target: 'C001',
  result: 'ok',
};

describe('engine.mutate.log', () => {
  describe('append', () => {
    it('ログエントリを追加する', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        log.append(draft, baseEntry);
      });
      expect(result.log).toHaveLength(1);
      expect(result.log[0]).toEqual(baseEntry);
    });

    it('複数のエントリを追加する', () => {
      const s = createEmptyGameState();
      const entry2: LogEntry = { ts: 2000, player: 'opp', turn: 1, action: 'action' };
      const result = produce(s, draft => {
        log.append(draft, baseEntry);
        log.append(draft, entry2);
      });
      expect(result.log).toHaveLength(2);
      expect(result.log[1]).toEqual(entry2);
    });
  });

  describe('clear', () => {
    it('ログをすべてクリアする', () => {
      const s = { ...createEmptyGameState(), log: [baseEntry, baseEntry] };
      const result = produce(s, draft => {
        log.clear(draft);
      });
      expect(result.log).toHaveLength(0);
    });
  });
});
