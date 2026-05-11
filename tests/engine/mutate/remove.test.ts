// rules: 03-field-areas.md, 14-refresh.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { remove } from '@/engine/mutate/remove';

describe('engine.mutate.remove', () => {
  describe('add', () => {
    it('リムーブエリアにカードを追加する', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        remove.add(draft, 'self', ['C001', 'C002']);
      });
      expect(result.players.self.remove).toContain('C001');
      expect(result.players.self.remove).toContain('C002');
    });

    it('空配列は no-op', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        remove.add(draft, 'self', []);
      });
      expect(result.players.self.remove).toHaveLength(0);
    });

    it('opp のリムーブエリアにも追加できる', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        remove.add(draft, 'opp', ['OPP001']);
      });
      expect(result.players.opp.remove).toContain('OPP001');
    });
  });

  describe('removeFromHere', () => {
    it('リムーブエリアから指定カードを取り除く', () => {
      const s = {
        ...createEmptyGameState(),
        players: {
          self: { ...createEmptyGameState().players.self, remove: ['C001', 'C002', 'C003'] },
          opp: createEmptyGameState().players.opp,
        },
      };
      const result = produce(s, draft => {
        remove.removeFromHere(draft, 'self', ['C002']);
      });
      expect(result.players.self.remove).not.toContain('C002');
      expect(result.players.self.remove).toContain('C001');
      expect(result.players.self.remove).toContain('C003');
    });

    it('同じ ID が複数ある場合は最初の1枚のみ削除', () => {
      const s = {
        ...createEmptyGameState(),
        players: {
          self: { ...createEmptyGameState().players.self, remove: ['C001', 'C001', 'C001'] },
          opp: createEmptyGameState().players.opp,
        },
      };
      const result = produce(s, draft => {
        remove.removeFromHere(draft, 'self', ['C001']);
      });
      expect(result.players.self.remove).toHaveLength(2);
    });

    it('存在しないカードは no-op', () => {
      const s = {
        ...createEmptyGameState(),
        players: {
          self: { ...createEmptyGameState().players.self, remove: ['C001'] },
          opp: createEmptyGameState().players.opp,
        },
      };
      const result = produce(s, draft => {
        remove.removeFromHere(draft, 'self', ['NONEXISTENT']);
      });
      expect(result.players.self.remove).toHaveLength(1);
    });
  });
});
