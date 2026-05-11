// rules: 10-action-event.md, 11-reasoning.md, 14-refresh.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { evidence } from '@/engine/mutate/evidence';
import type { GameState, EvidenceOrigin } from '@/engine/types';

function makeState(overrides?: Partial<GameState['players']['self']>): GameState {
  const s = createEmptyGameState();
  if (!overrides) return s;
  return {
    ...s,
    players: {
      self: { ...s.players.self, ...overrides },
      opp: s.players.opp,
    },
  };
}

const baseOrigin: EvidenceOrigin = { turn: 1, via: 'reasoning' };

describe('engine.mutate.evidence', () => {
  describe('addFromDeck', () => {
    it('デッキ上から n 枚を証拠エリアに追加する', () => {
      const s = makeState({ deck: ['C001', 'C002', 'C003'] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 2, false, baseOrigin);
      });
      expect(result.players.self.evidence).toHaveLength(2);
      expect(result.players.self.evidence[0].cardId).toBe('C001');
      expect(result.players.self.evidence[1].cardId).toBe('C002');
      expect(result.players.self.deck).toEqual(['C003']);
    });

    it('faceUp=true で表向き証拠を追加する', () => {
      const s = makeState({ deck: ['C001'] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 1, true, baseOrigin);
      });
      expect(result.players.self.evidence[0].faceUp).toBe(true);
    });

    it('faceUp=false で裏向き証拠を追加する (rules/11)', () => {
      const s = makeState({ deck: ['C001'] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 1, false, baseOrigin);
      });
      expect(result.players.self.evidence[0].faceUp).toBe(false);
    });

    it('origin が正しく設定される', () => {
      const origin: EvidenceOrigin = { turn: 3, via: 'action-case', sourceCardId: 'ATK001' };
      const s = makeState({ deck: ['C001'] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 1, false, origin);
      });
      expect(result.players.self.evidence[0].origin).toEqual(origin);
    });

    it('デッキが空の場合は追加しない', () => {
      const s = makeState({ deck: [] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 3, false, baseOrigin);
      });
      expect(result.players.self.evidence).toHaveLength(0);
    });

    it('n=0 は何もしない', () => {
      const s = makeState({ deck: ['C001'] });
      const result = produce(s, draft => {
        evidence.addFromDeck(draft, 'self', 0, false, baseOrigin);
      });
      expect(result.players.self.evidence).toHaveLength(0);
      expect(result.players.self.deck).toHaveLength(1);
    });

    it('opp プレイヤーの証拠にも追加できる', () => {
      const s = createEmptyGameState();
      const withDeck = {
        ...s,
        players: {
          self: s.players.self,
          opp: { ...s.players.opp, deck: ['OPP001'] },
        },
      };
      const result = produce(withDeck, draft => {
        evidence.addFromDeck(draft, 'opp', 1, false, baseOrigin);
      });
      expect(result.players.opp.evidence).toHaveLength(1);
    });
  });

  describe('removeTop', () => {
    it('証拠最上部の1枚をリムーブする (rules/10)', () => {
      const s = makeState({
        evidence: [
          { cardId: 'EV001', faceUp: false, origin: baseOrigin },
          { cardId: 'EV002', faceUp: false, origin: baseOrigin },
        ],
      });
      let removed: ReturnType<typeof evidence.removeTop>;
      const result = produce(s, draft => {
        removed = evidence.removeTop(draft, 'self');
      });
      // 末尾 (最上部) が削除される
      expect(result.players.self.evidence).toHaveLength(1);
      expect(result.players.self.evidence[0].cardId).toBe('EV001');
      expect(removed!.cardId).toBe('EV002');
    });

    it('リムーブされたカードはリムーブエリアへ移動', () => {
      const s = makeState({
        evidence: [{ cardId: 'EV001', faceUp: false, origin: baseOrigin }],
      });
      const result = produce(s, draft => {
        evidence.removeTop(draft, 'self');
      });
      expect(result.players.self.remove).toContain('EV001');
    });

    it('証拠が空の場合は undefined を返す', () => {
      const s = makeState({ evidence: [] });
      let removed: ReturnType<typeof evidence.removeTop>;
      produce(s, draft => {
        removed = evidence.removeTop(draft, 'self');
      });
      expect(removed!).toBeUndefined();
    });
  });

  describe('removeAt', () => {
    it('指定インデックスの証拠をリムーブする', () => {
      const s = makeState({
        evidence: [
          { cardId: 'EV001', faceUp: false, origin: baseOrigin },
          { cardId: 'EV002', faceUp: false, origin: baseOrigin },
          { cardId: 'EV003', faceUp: false, origin: baseOrigin },
        ],
      });
      let removed: ReturnType<typeof evidence.removeAt>;
      const result = produce(s, draft => {
        removed = evidence.removeAt(draft, 'self', 1);
      });
      expect(result.players.self.evidence).toHaveLength(2);
      expect(removed!.cardId).toBe('EV002');
      expect(result.players.self.remove).toContain('EV002');
    });

    it('範囲外インデックスは undefined を返す', () => {
      const s = makeState({
        evidence: [{ cardId: 'EV001', faceUp: false, origin: baseOrigin }],
      });
      let removed: ReturnType<typeof evidence.removeAt>;
      produce(s, draft => {
        removed = evidence.removeAt(draft, 'self', 99);
      });
      expect(removed!).toBeUndefined();
    });
  });

  describe('flipFaceUp', () => {
    it('裏向きの証拠を表向きにする', () => {
      const s = makeState({
        evidence: [{ cardId: 'EV001', faceUp: false, origin: baseOrigin }],
      });
      const result = produce(s, draft => {
        evidence.flipFaceUp(draft, 'self', 0);
      });
      expect(result.players.self.evidence[0].faceUp).toBe(true);
    });

    it('範囲外インデックスは no-op', () => {
      const s = makeState({
        evidence: [{ cardId: 'EV001', faceUp: false, origin: baseOrigin }],
      });
      expect(() =>
        produce(s, draft => {
          evidence.flipFaceUp(draft, 'self', 99);
        }),
      ).not.toThrow();
    });
  });

  describe('toRemove', () => {
    it('指定証拠をリムーブエリアへ移動する', () => {
      const ev = { cardId: 'EV001', faceUp: false, origin: baseOrigin };
      const s = makeState({ evidence: [ev] });
      const result = produce(s, draft => {
        evidence.toRemove(draft, ev);
      });
      expect(result.players.self.evidence).toHaveLength(0);
      expect(result.players.self.remove).toContain('EV001');
    });
  });
});
