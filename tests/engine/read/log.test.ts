import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { log } from '@/engine/read/log';
import type { GameState, LogEntry } from '@/engine/types';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    ts: Date.now(),
    player: 'self',
    turn: 1,
    action: 'reasoning',
    ...overrides,
  };
}

function withLog(entries: LogEntry[]): GameState {
  const s = createEmptyGameState();
  return { ...s, log: entries };
}

describe('engine.read.log', () => {
  describe('tail', () => {
    it('末尾 n 件を返す', () => {
      const entries = [
        makeEntry({ ts: 1, action: 'a' }),
        makeEntry({ ts: 2, action: 'b' }),
        makeEntry({ ts: 3, action: 'c' }),
        makeEntry({ ts: 4, action: 'd' }),
      ];
      const s = withLog(entries);
      const result = log.tail(s, 2);
      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('c');
      expect(result[1].action).toBe('d');
    });

    it('n がログ件数より大きい場合は全件', () => {
      const s = withLog([makeEntry(), makeEntry()]);
      expect(log.tail(s, 10)).toHaveLength(2);
    });

    it('空ログは空配列', () => {
      const s = createEmptyGameState();
      expect(log.tail(s, 5)).toEqual([]);
    });

    it('n=0 は空配列', () => {
      const s = withLog([makeEntry(), makeEntry()]);
      expect(log.tail(s, 0)).toEqual([]);
    });
  });

  describe('byTurn', () => {
    it('特定ターンのログを取得', () => {
      const s = withLog([
        makeEntry({ turn: 1, action: 'a' }),
        makeEntry({ turn: 2, action: 'b' }),
        makeEntry({ turn: 1, action: 'c' }),
        makeEntry({ turn: 3, action: 'd' }),
      ]);
      const result = log.byTurn(s, 1);
      expect(result).toHaveLength(2);
      expect(result.map(e => e.action)).toContain('a');
      expect(result.map(e => e.action)).toContain('c');
    });

    it('該当ターンなければ空配列', () => {
      const s = withLog([makeEntry({ turn: 1 })]);
      expect(log.byTurn(s, 99)).toEqual([]);
    });
  });

  describe('byPlayer', () => {
    it('特定プレイヤーのログを取得', () => {
      const s = withLog([
        makeEntry({ player: 'self', action: 'reasoning' }),
        makeEntry({ player: 'opp', action: 'action' }),
        makeEntry({ player: 'self', action: 'next-hint' }),
      ]);
      const selfLogs = log.byPlayer(s, 'self');
      expect(selfLogs).toHaveLength(2);
      const oppLogs = log.byPlayer(s, 'opp');
      expect(oppLogs).toHaveLength(1);
    });

    it('プレイヤーのログがない場合は空配列', () => {
      const s = withLog([makeEntry({ player: 'opp' })]);
      expect(log.byPlayer(s, 'self')).toEqual([]);
    });
  });

  describe('search', () => {
    it('述語でフィルタリング', () => {
      const s = withLog([
        makeEntry({ action: 'reasoning', player: 'self' }),
        makeEntry({ action: 'action', player: 'opp' }),
        makeEntry({ action: 'reasoning', player: 'opp' }),
      ]);
      const result = log.search(s, e => e.action === 'reasoning');
      expect(result).toHaveLength(2);
    });

    it('一致なしは空配列', () => {
      const s = withLog([makeEntry({ action: 'a' })]);
      expect(log.search(s, e => e.action === 'z')).toEqual([]);
    });

    it('空ログは空配列', () => {
      const s = createEmptyGameState();
      expect(log.search(s, () => true)).toEqual([]);
    });

    it('target フィールドも検索できる', () => {
      const s = withLog([
        makeEntry({ target: 'uid-123' }),
        makeEntry({ target: undefined }),
      ]);
      const result = log.search(s, e => e.target === 'uid-123');
      expect(result).toHaveLength(1);
    });
  });
});
