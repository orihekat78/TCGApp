// rules: 01-victory-conditions.md, 14-refresh.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { gameResult } from '@/engine/mutate/gameResult';

describe('engine.mutate.gameResult', () => {
  describe('set', () => {
    it('self の事件解決勝利を設定する (rules/01)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'self', 'evidence');
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    });

    it('opp のデッキアウト勝利を設定する (rules/14)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'opp', 'deck-out');
      });
      expect(result.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    });

    it('投了を設定する', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'self', 'concede');
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'concede' });
    });
  });

  describe('clear', () => {
    it('ゲーム結果をクリアする', () => {
      const s = {
        ...createEmptyGameState(),
        gameResult: { winner: 'self' as const, reason: 'evidence' as const },
      };
      const result = produce(s, draft => {
        gameResult.clear(draft);
      });
      expect(result.gameResult).toBeUndefined();
    });
  });
});
