// rules: 04-game-setup.md (マリガン), 05-turn-phases.md (手札の使用)
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { hand } from '@/engine/mutate/hand';
import type { GameState } from '@/engine/types';

function makeState(h: string[] = [], deck: string[] = [], remove: string[] = []): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      self: { ...s.players.self, hand: h, deck, remove },
    },
  };
}

describe('engine.mutate.hand', () => {
  describe('add', () => {
    it('手札にカードを追加する', () => {
      const s = makeState(['h1']);
      const result = produce(s, draft => {
        hand.add(draft, 'self', ['h2', 'h3']);
      });
      expect(result.players.self.hand).toEqual(['h1', 'h2', 'h3']);
    });

    it('空配列の追加は何も変わらない', () => {
      const s = makeState(['h1']);
      const result = produce(s, draft => {
        hand.add(draft, 'self', []);
      });
      expect(result.players.self.hand).toEqual(['h1']);
    });

    it('opp の手札にも追加できる', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        hand.add(draft, 'opp', ['o1']);
      });
      expect(result.players.opp.hand).toEqual(['o1']);
    });
  });

  describe('remove', () => {
    it('手札から指定 ID のカードを削除する', () => {
      const s = makeState(['h1', 'h2', 'h3']);
      const result = produce(s, draft => {
        hand.remove(draft, 'self', ['h2']);
      });
      expect(result.players.self.hand).toEqual(['h1', 'h3']);
    });

    it('複数枚削除', () => {
      const s = makeState(['a', 'b', 'c', 'd']);
      const result = produce(s, draft => {
        hand.remove(draft, 'self', ['a', 'c']);
      });
      expect(result.players.self.hand).toEqual(['b', 'd']);
    });

    it('存在しない ID は無視される', () => {
      const s = makeState(['h1', 'h2']);
      const result = produce(s, draft => {
        hand.remove(draft, 'self', ['nonexistent']);
      });
      expect(result.players.self.hand).toEqual(['h1', 'h2']);
    });

    it('同じ ID が複数ある場合は最初の一枚のみ削除', () => {
      const s = makeState(['c1', 'c1', 'c2']);
      const result = produce(s, draft => {
        hand.remove(draft, 'self', ['c1']);
      });
      expect(result.players.self.hand).toEqual(['c1', 'c2']);
    });
  });

  describe('discardToRemove', () => {
    it('手札→リムーブエリアへ移動', () => {
      const s = makeState(['h1', 'h2', 'h3']);
      const result = produce(s, draft => {
        hand.discardToRemove(draft, 'self', ['h1', 'h3']);
      });
      expect(result.players.self.hand).toEqual(['h2']);
      expect(result.players.self.remove).toContain('h1');
      expect(result.players.self.remove).toContain('h3');
    });

    it('リムーブエリアに既存カードがあれば追記', () => {
      const s = makeState(['h1'], [], ['existing']);
      const result = produce(s, draft => {
        hand.discardToRemove(draft, 'self', ['h1']);
      });
      expect(result.players.self.remove).toContain('existing');
      expect(result.players.self.remove).toContain('h1');
    });
  });

  describe('toDeckBottom', () => {
    it('手札→デッキの下へ (マリガン用) (rules/04)', () => {
      const s = makeState(['h1', 'h2', 'h3'], ['d1', 'd2']);
      const result = produce(s, draft => {
        hand.toDeckBottom(draft, 'self', ['h1', 'h3']);
      });
      expect(result.players.self.hand).toEqual(['h2']);
      // デッキの下に追加
      expect(result.players.self.deck).toEqual(['d1', 'd2', 'h1', 'h3']);
    });

    it('空リストは何も変わらない', () => {
      const s = makeState(['h1', 'h2'], ['d1']);
      const result = produce(s, draft => {
        hand.toDeckBottom(draft, 'self', []);
      });
      expect(result.players.self.hand).toEqual(['h1', 'h2']);
      expect(result.players.self.deck).toEqual(['d1']);
    });
  });
});
