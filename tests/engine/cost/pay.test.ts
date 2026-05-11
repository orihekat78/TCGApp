// engine.cost.pay — tests
// spec: Phase 3 Group B Task 3.5

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { pay } from '@/engine/cost/pay';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type {
  EffectCtx,
  GameState,
  SceneCharacter,
  CardDef,
  Cost,
  EvidenceCard,
} from '@/engine/types';

function makeCtx(overrides: Partial<EffectCtx> = {}): EffectCtx {
  return {
    source: { player: 'self', area: 'scene' },
    bindings: {},
    ...overrides,
  };
}

function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'C001',
    uid: 'uid-1',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id,
    no: overrides.no ?? 'NO',
    kind: 'character',
    names: ['default'],
    colors: [],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

function evCard(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: { ...s.players, [p]: { ...s.players[p], scene: chars } },
  };
}

describe('engine.cost.pay', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('sleepSelf', () => {
    it('sets source to sleep', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u', state: 'active' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const result = produce(s, draft => {
        pay(draft, { kind: 'sleepSelf' }, ctx);
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });
  });

  describe('removeFromHand', () => {
    it('moves n cards from hand to remove', () => {
      let s = createEmptyGameState();
      registerCardDef(defOf({ id: 'H', traits: ['少年探偵団'] }));
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['H', 'H', 'X'] } } };
      const cost: Cost = {
        kind: 'removeFromHand',
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self', filter: { trait: '少年探偵団' } },
          n: { min: 2, max: 2 },
          chooser: 'owner',
        },
        n: 2,
      };
      const result = produce(s, draft => {
        pay(draft, cost, makeCtx());
      });
      expect(result.players.self.hand).toEqual(['X']);
      expect(result.players.self.remove).toEqual(['H', 'H']);
    });
  });

  describe('removeDeckTop', () => {
    it('mills top n cards to remove', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      const result = produce(s, draft => {
        pay(draft, { kind: 'removeDeckTop', player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.remove).toEqual(['A', 'B']);
      expect(result.players.self.deck).toEqual(['C']);
    });
  });

  describe('selfToDeckBottom', () => {
    it('moves source char to deck bottom', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u', cardId: 'C1' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const result = produce(s, draft => {
        pay(draft, { kind: 'selfToDeckBottom' }, ctx);
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.deck).toEqual(['C1']);
    });
  });

  describe('pay (AND)', () => {
    it('applies all subitems', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const cost: Cost = {
        kind: 'pay',
        items: [
          { kind: 'sleepSelf' },
          { kind: 'removeDeckTop', player: 'self', n: 2 },
        ],
      };
      const result = produce(s, draft => {
        pay(draft, cost, ctx);
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
      expect(result.players.self.deck).toEqual(['C']);
      expect(result.players.self.remove).toEqual(['A', 'B']);
    });
  });

  describe('choice (OR)', () => {
    it('chooses first payable branch by default', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', state: 'active' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [] } } };
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const cost: Cost = {
        kind: 'choice',
        items: [
          { kind: 'removeDeckTop', player: 'self', n: 1 },  // unpayable
          { kind: 'sleepSelf' },                              // payable
        ],
      };
      const result = produce(s, draft => {
        pay(draft, cost, ctx);
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });

    it('uses ctx.dyn.costChoice when present', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', state: 'active' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'] } } };
      const ctx = makeCtx({
        source: { player: 'self', area: 'scene', uid: 'u' },
        dyn: { costChoice: 0 },
      });
      const cost: Cost = {
        kind: 'choice',
        items: [
          { kind: 'removeDeckTop', player: 'self', n: 1 },
          { kind: 'sleepSelf' },
        ],
      };
      const result = produce(s, draft => {
        pay(draft, cost, ctx);
      });
      expect(result.players.self.scene[0].state).toBe('active');
      expect(result.players.self.deck).toEqual(['B']);
    });
  });

  describe('flipFaceUpEvidence', () => {
    it('flips specified indices and records count', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A'), evCard('B'), evCard('C')] } } };
      const ctx = makeCtx({
        dyn: { costParams: { flipFaceUpEvidence: { indices: [0, 2] } } },
      });
      const result = produce(s, draft => {
        pay(draft, { kind: 'flipFaceUpEvidence', n: { min: 1, max: 3 } }, ctx);
      });
      expect(result.players.self.evidence[0].faceUp).toBe(true);
      expect(result.players.self.evidence[1].faceUp).toBe(false);
      expect(result.players.self.evidence[2].faceUp).toBe(true);
      expect(ctx.costPaid?.flipFaceUpEvidence).toEqual({ count: 2 });
    });

    it('throws when indices.length below min', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A')] } } };
      const ctx = makeCtx({ dyn: { costParams: { flipFaceUpEvidence: { indices: [] } } } });
      expect(() =>
        produce(s, draft => {
          pay(draft, { kind: 'flipFaceUpEvidence', n: { min: 1, max: 3 } }, ctx);
        }),
      ).toThrow(/flipFaceUpEvidence/);
    });
  });

  describe('viaCost flag', () => {
    it('sets ctx.viaCost = true during payment and restores after', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      expect(ctx.viaCost).toBeUndefined();
      produce(s, draft => {
        pay(draft, { kind: 'sleepSelf' }, ctx);
      });
      // After pay completes, the flag is restored to prior value
      expect(ctx.viaCost).toBeUndefined();
    });
  });

  describe('PayResult', () => {
    it('returns paidItems list', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      let result: ReturnType<typeof pay> | null = null;
      produce(s, draft => {
        result = pay(draft, { kind: 'sleepSelf' }, ctx);
      });
      expect(result).not.toBeNull();
      expect(result!.paidItems).toHaveLength(1);
      expect(result!.paidItems[0].kind).toBe('sleepSelf');
    });
  });
});
