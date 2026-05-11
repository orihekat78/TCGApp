// engine.cost.canPay — tests
// spec: Phase 3 Group B Task 3.5

import { describe, it, expect, beforeEach } from 'vitest';
import { canPay } from '@/engine/cost/evaluate';
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

describe('engine.cost.canPay', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('sleepSelf', () => {
    it('true when source is active', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u', state: 'active' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      expect(canPay(s, { kind: 'sleepSelf' }, ctx)).toBe(true);
    });

    it('false when source is already sleep (no-op cost not payable)', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u', state: 'sleep' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      expect(canPay(s, { kind: 'sleepSelf' }, ctx)).toBe(false);
    });

    it('false when source is stun', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u', state: 'stun' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      expect(canPay(s, { kind: 'sleepSelf' }, ctx)).toBe(false);
    });

    it('false when no uid', () => {
      const s = createEmptyGameState();
      expect(canPay(s, { kind: 'sleepSelf' }, makeCtx())).toBe(false);
    });
  });

  describe('removeFromHand', () => {
    it('true when n cards available', () => {
      let s = createEmptyGameState();
      registerCardDef(defOf({ id: 'H', traits: ['少年探偵団'] }));
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['H', 'H'] } } };
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
      expect(canPay(s, cost, makeCtx())).toBe(true);
    });

    it('false when insufficient hand', () => {
      let s = createEmptyGameState();
      registerCardDef(defOf({ id: 'H', traits: ['少年探偵団'] }));
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['H'] } } };
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
      expect(canPay(s, cost, makeCtx())).toBe(false);
    });
  });

  describe('removeDeckTop', () => {
    it('true when deck has enough', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      expect(canPay(s, { kind: 'removeDeckTop', player: 'self', n: 3 }, makeCtx())).toBe(true);
    });

    it('false when deck short', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A'] } } };
      expect(canPay(s, { kind: 'removeDeckTop', player: 'self', n: 3 }, makeCtx())).toBe(false);
    });
  });

  describe('discardEvidence', () => {
    it('true when evidence count sufficient', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A'), evCard('B')] } } };
      expect(canPay(s, { kind: 'discardEvidence', n: 2 }, makeCtx())).toBe(true);
    });
  });

  describe('selfToDeckBottom', () => {
    it('true when source on scene', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      expect(canPay(s, { kind: 'selfToDeckBottom' }, ctx)).toBe(true);
    });

    it('false when source not found', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'X' } });
      expect(canPay(s, { kind: 'selfToDeckBottom' }, ctx)).toBe(false);
    });
  });

  describe('pay (AND)', () => {
    it('true only if all subitems canPay', () => {
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
      expect(canPay(s, cost, ctx)).toBe(true);
    });

    it('false if one subitem fails', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [] } } };
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const cost: Cost = {
        kind: 'pay',
        items: [
          { kind: 'sleepSelf' },
          { kind: 'removeDeckTop', player: 'self', n: 1 },
        ],
      };
      expect(canPay(s, cost, ctx)).toBe(false);
    });
  });

  describe('choice (OR)', () => {
    it('true if any branch viable', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [] } } };
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const cost: Cost = {
        kind: 'choice',
        items: [
          { kind: 'removeDeckTop', player: 'self', n: 1 },
          { kind: 'sleepSelf' },
        ],
      };
      expect(canPay(s, cost, ctx)).toBe(true);
    });

    it('false if none viable', () => {
      const s = createEmptyGameState();
      const cost: Cost = {
        kind: 'choice',
        items: [{ kind: 'removeDeckTop', player: 'self', n: 1 }],
      };
      expect(canPay(s, cost, makeCtx())).toBe(false);
    });
  });

  describe('flipFaceUpEvidence', () => {
    it('true when enough face-down evidence', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A', false), evCard('B', false)] } } };
      expect(canPay(s, { kind: 'flipFaceUpEvidence', n: { min: 1, max: 5 } }, makeCtx())).toBe(true);
    });

    it('false when no face-down evidence', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A', true)] } } };
      expect(canPay(s, { kind: 'flipFaceUpEvidence', n: { min: 1, max: 5 } }, makeCtx())).toBe(false);
    });
  });

  describe('fileFrom', () => {
    it('true when file has enough', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, file: [{ type: 'card-back' }, { type: 'card-back' }] } } };
      expect(canPay(s, { kind: 'fileFrom', n: 2 }, makeCtx())).toBe(true);
    });
  });

  describe('custom', () => {
    it('delegates to check fn', () => {
      const s = createEmptyGameState();
      const cost: Cost = {
        kind: 'custom',
        check: () => false,
        pay: () => {},
      };
      expect(canPay(s, cost, makeCtx())).toBe(false);
    });
  });
});
