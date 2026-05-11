// engine.cond.eval — tests
// spec: Phase 3 Group B Task 3.6

import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond, evalAll } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type {
  EffectCtx,
  GameState,
  SceneCharacter,
  CardDef,
  Condition,
  TargetingRef,
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

describe('engine.cond.eval', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('boolean kinds', () => {
    it('true → true', () => {
      expect(evalCond(createEmptyGameState(), { kind: 'true' }, makeCtx())).toBe(true);
    });

    it('false → false', () => {
      expect(evalCond(createEmptyGameState(), { kind: 'false' }, makeCtx())).toBe(false);
    });

    it('not negates', () => {
      expect(evalCond(createEmptyGameState(), { kind: 'not', c: { kind: 'true' } }, makeCtx())).toBe(false);
    });

    it('and is conjunctive', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'and', cs: [{ kind: 'true' }, { kind: 'true' }] }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'and', cs: [{ kind: 'true' }, { kind: 'false' }] }, makeCtx())).toBe(false);
    });

    it('or is disjunctive', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'or', cs: [{ kind: 'true' }, { kind: 'false' }] }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'or', cs: [{ kind: 'false' }, { kind: 'false' }] }, makeCtx())).toBe(false);
    });
  });

  describe('turn', () => {
    it('self matches when owner is turn player', () => {
      const s = { ...createEmptyGameState(), turn: { ...createEmptyGameState().turn, player: 'self' as const } };
      expect(evalCond(s, { kind: 'turn', player: 'self' }, makeCtx())).toBe(true);
    });

    it('opp matches when opp is turn player', () => {
      const s = { ...createEmptyGameState(), turn: { ...createEmptyGameState().turn, player: 'opp' as const } };
      expect(evalCond(s, { kind: 'turn', player: 'opp' }, makeCtx())).toBe(true);
    });
  });

  describe('partnerColor', () => {
    it('single color match', () => {
      registerCardDef(defOf({ id: 'P', kind: 'partner', colors: ['赤', '青'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { ...s.players.self.partner, cardId: 'P' } } } };
      expect(evalCond(s, { kind: 'partnerColor', color: '赤' }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'partnerColor', color: '黄' }, makeCtx())).toBe(false);
    });

    it('array color match (OR)', () => {
      registerCardDef(defOf({ id: 'P', kind: 'partner', colors: ['赤'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { ...s.players.self.partner, cardId: 'P' } } } };
      expect(evalCond(s, { kind: 'partnerColor', color: ['赤', '青'] }, makeCtx())).toBe(true);
    });
  });

  describe('caseColor', () => {
    it('default combine=or (any match)', () => {
      registerCardDef(defOf({ id: 'CASE', kind: 'case', colors: ['赤'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE' } } } };
      expect(evalCond(s, { kind: 'caseColor', color: ['赤', '青'] }, makeCtx())).toBe(true);
    });

    it('combine=and requires all colors present', () => {
      registerCardDef(defOf({ id: 'CASE', kind: 'case', colors: ['赤'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE' } } } };
      expect(evalCond(s, { kind: 'caseColor', color: ['赤', '青'], combine: 'and' }, makeCtx())).toBe(false);

      registerCardDef(defOf({ id: 'CASE2', kind: 'case', colors: ['赤', '青'] }));
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE2' } } } };
      expect(evalCond(s, { kind: 'caseColor', color: ['赤', '青'], combine: 'and' }, makeCtx())).toBe(true);
    });
  });

  describe('fileAtLeast', () => {
    it('checks file length', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, file: [{ type: 'card-back' }, { type: 'card-back' }] } } };
      expect(evalCond(s, { kind: 'fileAtLeast', n: 2 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'fileAtLeast', n: 3 }, makeCtx())).toBe(false);
    });
  });

  describe('caseStatus', () => {
    it('checks case status', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, status: '解決編' } } } };
      expect(evalCond(s, { kind: 'caseStatus', status: '解決編' }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'caseStatus', status: '事件編' }, makeCtx())).toBe(false);
    });
  });

  describe('bond (rules/17 — partner excluded)', () => {
    it('matches when scene has cardName', () => {
      registerCardDef(defOf({ id: 'CONAN', names: ['江戸川コナン'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', cardId: 'CONAN' })]);
      expect(evalCond(s, { kind: 'bond', cardName: '江戸川コナン' }, makeCtx())).toBe(true);
    });

    it('does NOT match when only partner has the name', () => {
      registerCardDef(defOf({ id: 'CONAN_PARTNER', kind: 'partner', names: ['江戸川コナン'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { ...s.players.self.partner, cardId: 'CONAN_PARTNER' } } } };
      // No char on scene
      expect(evalCond(s, { kind: 'bond', cardName: '江戸川コナン' }, makeCtx())).toBe(false);
    });

    it('matches via split-name (rules/19)', () => {
      registerCardDef(defOf({
        id: 'SPLIT',
        names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'],
      }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', cardId: 'SPLIT' })]);
      expect(evalCond(s, { kind: 'bond', cardName: '工藤新一' }, makeCtx())).toBe(true);
    });
  });

  describe('sceneHas', () => {
    it('returns true when count >= nMin', () => {
      registerCardDef(defOf({ id: 'A', traits: ['探偵'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'A' }),
      ]);
      const cond: Condition = {
        kind: 'sceneHas',
        query: { side: 'self', filter: { trait: '探偵' } },
        nMin: 2,
      };
      expect(evalCond(s, cond, makeCtx())).toBe(true);
    });

    it('default nMin = 1', () => {
      registerCardDef(defOf({ id: 'A', traits: ['探偵'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'A' })]);
      expect(evalCond(s, { kind: 'sceneHas', query: { side: 'self', filter: { trait: '探偵' } } }, makeCtx())).toBe(true);
    });
  });

  describe('apAtLeast / lpAtLeast', () => {
    it('apAtLeast on self', () => {
      registerCardDef(defOf({ id: 'A', ap: 5000 }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', cardId: 'A' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const ref: TargetingRef = { kind: 'self' };
      expect(evalCond(s, { kind: 'apAtLeast', ref, n: 4000 }, ctx)).toBe(true);
      expect(evalCond(s, { kind: 'apAtLeast', ref, n: 6000 }, ctx)).toBe(false);
    });
  });

  describe('evidenceAtLeast', () => {
    it('checks evidence count', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, evidence: [evCard('A'), evCard('B'), evCard('C')] } } };
      expect(evalCond(s, { kind: 'evidenceAtLeast', player: 'self', n: 3 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'evidenceAtLeast', player: 'self', n: 4 }, makeCtx())).toBe(false);
    });
  });

  describe('fileTopType', () => {
    it('checks file top type', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, file: [{ type: 'card-back' }, { type: 'assisted-partner', cardId: 'P' }] } } };
      expect(evalCond(s, { kind: 'fileTopType', type: 'assisted-partner' }, makeCtx())).toBe(true);
    });
  });

  describe('scratchTrace', () => {
    it('checks trace state', () => {
      let s = createEmptyGameState();
      s = { ...s, scratchTrace: { self: '発見済', opp: '未発見' } };
      expect(evalCond(s, { kind: 'scratchTrace', player: 'self', v: '発見済' }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'scratchTrace', player: 'self', v: '未発見' }, makeCtx())).toBe(false);
    });
  });

  describe('flag', () => {
    it('checks turn-scoped flag', () => {
      let s = createEmptyGameState();
      s = { ...s, turnState: { ...s.turnState, self: { ...s.turnState.self, handUseUsed: true } } };
      expect(evalCond(s, { kind: 'flag', player: 'self', key: 'handUseUsed', v: true }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'flag', player: 'self', key: 'assistedThisTurn', v: true }, makeCtx())).toBe(false);
    });
  });

  describe('declaredUseUnder', () => {
    it('counts uses', () => {
      let s = createEmptyGameState();
      const c = makeChar({ uid: 'u', declaredUseCount: { 'ability-1': 1 } });
      s = withScene(s, 'self', [c]);
      expect(evalCond(s, { kind: 'declaredUseUnder', uid: 'u', abilityId: 'ability-1', max: 2 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'declaredUseUnder', uid: 'u', abilityId: 'ability-1', max: 1 }, makeCtx())).toBe(false);
    });
  });

  describe('bound', () => {
    it('exists: key is in bindings', () => {
      const ctx = makeCtx({ bindings: { k: [] } });
      expect(evalCond(createEmptyGameState(), { kind: 'bound', key: 'k' }, ctx)).toBe(true);
      expect(evalCond(createEmptyGameState(), { kind: 'bound', key: 'missing' }, ctx)).toBe(false);
    });

    it('matched: key has length > 0', () => {
      const ctx = makeCtx({ bindings: { k: [] } });
      expect(evalCond(createEmptyGameState(), { kind: 'bound', key: 'k', presence: 'matched' }, ctx)).toBe(false);
    });
  });

  describe('removeColorAtLeast', () => {
    it('counts remove pile by color', () => {
      registerCardDef(defOf({ id: 'YELLOW', colors: ['黄'] }));
      registerCardDef(defOf({ id: 'BLUE', colors: ['青'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, remove: ['YELLOW', 'YELLOW', 'BLUE', 'YELLOW'] } } };
      expect(evalCond(s, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 3 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 4 }, makeCtx())).toBe(false);
    });
  });

  describe('removeTraitAtLeast', () => {
    it('counts remove pile by trait', () => {
      registerCardDef(defOf({ id: 'POLICE', traits: ['警察'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, remove: ['POLICE', 'POLICE'] } } };
      expect(evalCond(s, { kind: 'removeTraitAtLeast', player: 'self', trait: '警察', n: 2 }, makeCtx())).toBe(true);
    });
  });

  describe('stackedCountAtLeast', () => {
    it('checks stacked card count', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', stackedCards: 3 })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const ref: TargetingRef = { kind: 'self' };
      expect(evalCond(s, { kind: 'stackedCountAtLeast', ref, n: 3 }, ctx)).toBe(true);
      expect(evalCond(s, { kind: 'stackedCountAtLeast', ref, n: 4 }, ctx)).toBe(false);
    });
  });

  describe('custom', () => {
    it('delegates to check callback', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'custom', check: () => true }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'custom', check: () => false }, makeCtx())).toBe(false);
    });
  });

  describe('evalAll', () => {
    it('evaluates each in order', () => {
      const s = createEmptyGameState();
      const result = evalAll(s, [
        { kind: 'true' },
        { kind: 'false' },
        { kind: 'true' },
      ], makeCtx());
      expect(result).toEqual([true, false, true]);
    });
  });
});
