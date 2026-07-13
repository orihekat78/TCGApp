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
import { makeChar, makeCtx } from '../../helpers/fixtures';


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

  describe('caseTrait (BUG-124: caseTraits field-drop)', () => {
    it('matches trait stored in caseTraits only (例 D08026=古城, traits:[])', () => {
      // 事件カードの特徴は caseTraits に格納される (traits=キャラ特徴用)。
      registerCardDef(defOf({ id: 'CASE_KOJO', kind: 'case', traits: [], caseTraits: ['古城'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE_KOJO' } } } };
      expect(evalCond(s, { kind: 'caseTrait', trait: '古城' }, makeCtx()), 'caseTraits の古城に一致').toBe(true);
      expect(evalCond(s, { kind: 'caseTrait', trait: '婚活' }, makeCtx()), '非該当 trait は false').toBe(false);
    });

    it('backward-compat: trait stored in traits (例 D11021=婚活 は両フィールド)', () => {
      registerCardDef(defOf({ id: 'CASE_KON', kind: 'case', traits: ['婚活'], caseTraits: ['婚活'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE_KON' } } } };
      expect(evalCond(s, { kind: 'caseTrait', trait: '婚活' }, makeCtx())).toBe(true);
    });

    it('no match when case has no such trait', () => {
      registerCardDef(defOf({ id: 'CASE_NONE', kind: 'case', traits: [], caseTraits: [] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, case: { ...s.players.self.case, cardId: 'CASE_NONE' } } } };
      expect(evalCond(s, { kind: 'caseTrait', trait: '古城' }, makeCtx())).toBe(false);
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

  describe('removeCountAtLeast', () => {
    it('counts the whole remove pile regardless of card identity (B03104)', () => {
      registerCardDef(defOf({ id: 'A', colors: ['黄'] }));
      registerCardDef(defOf({ id: 'B', colors: ['青'], traits: ['探偵'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, remove: ['A', 'B', 'A', 'B', 'A'] } } };
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'self', n: 5 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'self', n: 6 }, makeCtx())).toBe(false);
    });
    it('is false when the pile is short; n:0 is vacuously true', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'self', n: 1 }, makeCtx())).toBe(false);
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'self', n: 0 }, makeCtx())).toBe(true);
    });
    it('reads the specified player side (opp)', () => {
      registerCardDef(defOf({ id: 'A' }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, opp: { ...s.players.opp, remove: ['A', 'A'] } } };
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'opp', n: 2 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'removeCountAtLeast', player: 'self', n: 1 }, makeCtx())).toBe(false);
    });
  });

  describe('enterCountAtMost (B09089)', () => {
    it('fresh turn (field undefined) reads as 0 → atMost:0 is true', () => {
      // createEmptyTurnFlags does not initialize enterCountThisTurn → ?? 0 default
      expect(evalCond(createEmptyGameState(), { kind: 'enterCountAtMost', player: 'self', n: 0 }, makeCtx())).toBe(true);
    });
    it('decoy: a char entered this turn (count=1) flips n:0 to false but n>=1 stays true', () => {
      let s = createEmptyGameState();
      s = { ...s, turnState: { ...s.turnState, self: { ...s.turnState.self, enterCountThisTurn: 1 } } };
      // false-green guard: an impl ignoring the field, or hard-returning true, would fail the n:0===false line
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'self', n: 0 }, makeCtx())).toBe(false);
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'self', n: 1 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'self', n: 2 }, makeCtx())).toBe(true);
    });
    it('reads the specified player side independently (opp vs self)', () => {
      let s = createEmptyGameState();
      s = { ...s, turnState: { ...s.turnState,
        self: { ...s.turnState.self, enterCountThisTurn: 2 },
        opp: { ...s.turnState.opp, enterCountThisTurn: 0 } } };
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'opp', n: 0 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'self', n: 0 }, makeCtx())).toBe(false);
      expect(evalCond(s, { kind: 'enterCountAtMost', player: 'self', n: 2 }, makeCtx())).toBe(true);
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

  // D11007 v2 Phase 2: matcherCondition declarative 化用 (TriggerDef.matcherCondition)
  describe('contactOpponentApHigher (D11007 a3 driver)', () => {
    function setupContact(s: GameState, aAp: number, bAp: number): {
      state: GameState; aUid: string; bUid: string;
    } {
      const aChar = makeChar({ uid: 'A#0', cardId: 'A', apOverride: aAp });
      const bChar = makeChar({ uid: 'B#0', cardId: 'B', apOverride: bAp });
      registerCardDef(defOf({ id: 'A', ap: aAp, lp: 1, level: 1 }));
      registerCardDef(defOf({ id: 'B', ap: bAp, lp: 1, level: 1 }));
      const state = withScene(withScene(s, 'self', [aChar]), 'opp', [bChar]);
      return { state, aUid: 'A#0', bUid: 'B#0' };
    }

    it('自分(aUid)が攻撃者 & opponent (bUid) AP が higher → true', () => {
      const s = createEmptyGameState();
      const { state, aUid, bUid } = setupContact(s, 3000, 5000);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: aUid }, triggerPayload: { aUid, bUid } });
      expect(evalCond(state, { kind: 'contactOpponentApHigher' }, ctx)).toBe(true);
    });

    it('aUid !== ctx.source.uid (自分が攻撃者でない) → false (BUG-098 自己照合)', () => {
      const s = createEmptyGameState();
      const { state, aUid, bUid } = setupContact(s, 3000, 5000); // bAp>aAp だが自分は非当事者
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'OTHER#0' }, triggerPayload: { aUid, bUid } });
      expect(evalCond(state, { kind: 'contactOpponentApHigher' }, ctx)).toBe(false);
    });

    it('opponent (bUid) AP が equal → false (strict greater than)', () => {
      const s = createEmptyGameState();
      const { state, aUid, bUid } = setupContact(s, 5000, 5000);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: aUid }, triggerPayload: { aUid, bUid } });
      expect(evalCond(state, { kind: 'contactOpponentApHigher' }, ctx)).toBe(false);
    });

    it('opponent (bUid) AP が lower → false', () => {
      const s = createEmptyGameState();
      const { state, aUid, bUid } = setupContact(s, 5000, 3000);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: aUid }, triggerPayload: { aUid, bUid } });
      expect(evalCond(state, { kind: 'contactOpponentApHigher' }, ctx)).toBe(false);
    });

    it('payload 不在 / aUid 欠落 → false (defensive)', () => {
      const s = createEmptyGameState();
      const ctxNoPayload = makeCtx();
      expect(evalCond(s, { kind: 'contactOpponentApHigher' }, ctxNoPayload)).toBe(false);
      const ctxPartial = makeCtx({ triggerPayload: { aUid: 'X' } });
      expect(evalCond(s, { kind: 'contactOpponentApHigher' }, ctxPartial)).toBe(false);
    });
  });

  // D11014 v2 Phase 1: enterOrderEquals (【疾風 N】matcher → matcherCondition declarative)
  describe('enterOrderEquals (D11014 / D11003 / D11009 driver)', () => {
    it('payload.enterOrder === n → true', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ triggerPayload: { enterOrderThisTurn: 1 } });
      expect(evalCond(s, { kind: 'enterOrderEquals', n: 1 }, ctx)).toBe(true);
    });
    it('payload.enterOrder !== n → false', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ triggerPayload: { enterOrderThisTurn: 2 } });
      expect(evalCond(s, { kind: 'enterOrderEquals', n: 1 }, ctx)).toBe(false);
    });
    it('payload 不在 → false', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'enterOrderEquals', n: 1 }, makeCtx())).toBe(false);
    });
  });

  // D11014 v2 Phase 3: boundMatchesFilter (custom check → declarative)
  describe('boundMatchesFilter (D11014 a2 driver)', () => {
    it('binding[0].cardId が cardName filter に分割名完全一致 → true', () => {
      const s = createEmptyGameState();
      registerCardDef(defOf({ id: 'D11003', names: ['萩原千速'] }));
      const ctx = makeCtx({ bindings: { '$entered': [{ kind: 'card', cardId: 'D11003' } as never] } });
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } }, ctx)).toBe(true);
    });
    it('cardName が違うなら → false', () => {
      const s = createEmptyGameState();
      registerCardDef(defOf({ id: 'D11010', names: ['萩原研二'] }));
      const ctx = makeCtx({ bindings: { '$entered': [{ kind: 'card', cardId: 'D11010' } as never] } });
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } }, ctx)).toBe(false);
    });
    it('binding 空 → false (defensive)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ bindings: { '$entered': [] } });
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } }, ctx)).toBe(false);
    });
    it('binding 未設定 → false', () => {
      const s = createEmptyGameState();
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } }, makeCtx())).toBe(false);
    });
    it('trait filter も動く', () => {
      const s = createEmptyGameState();
      registerCardDef(defOf({ id: 'C1', traits: ['警察', '神奈川県警'] }));
      const ctx = makeCtx({ bindings: { '$e': [{ kind: 'card', cardId: 'C1' } as never] } });
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$e', filter: { trait: '警察' } }, ctx)).toBe(true);
      expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: '$e', filter: { trait: '探偵' } }, ctx)).toBe(false);
    });
  });

  describe('hostSetCardCountAtLeast (B06046)', () => {
    it('counts only face-up YAIBA set cards on the source host, never another host or hidden cards', () => {
      registerCardDef(defOf({ id: 'YAIBA_UP', traits: ['YAIBA'] }));
      registerCardDef(defOf({ id: 'YAIBA_DOWN', traits: ['YAIBA'] }));
      registerCardDef(defOf({ id: 'OTHER_UP', traits: ['OTHER'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'host', cardId: 'HOST', setCards: [
          { cardId: 'YAIBA_UP', faceUp: true },
          { cardId: 'YAIBA_DOWN', faceUp: false },
          { cardId: 'OTHER_UP', faceUp: true },
        ] }),
        makeChar({ uid: 'decoy', cardId: 'DECOY', setCards: [
          { cardId: 'YAIBA_UP', faceUp: true },
        ] }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'host' } });
      const cond = { kind: 'hostSetCardCountAtLeast', filter: { trait: 'YAIBA' }, n: 2 } as never;
      expect(evalCond(s, cond, ctx)).toBe(false);
      s.players.self.scene[0]!.setCards.push({ cardId: 'YAIBA_UP', faceUp: true });
      expect(evalCond(s, cond, ctx)).toBe(true);
    });
  });

  describe('boundCharStateIs (B09024 remove snapshot)', () => {
    it('sceneRemove 前にbindしたsleep stateだけをtrueとする', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ bindings: { '$removed': [{ cardId: 'C1', snapState: 'sleep' }] } });
      expect(evalCond(s, { kind: 'boundCharStateIs', bindKey: '$removed', state: 'sleep' } as never, ctx)).toBe(true);
      expect(evalCond(s, { kind: 'boundCharStateIs', bindKey: '$removed', state: 'active' } as never, ctx)).toBe(false);
    });
  });
});

// Task D E1 (2026-06-12): hand-count conditions
// rules: 15-abilities-effects.md §解決時参照, 21-declared-ability-cost.md §宣言ゲート
describe('hand-count conditions (Task D E1)', () => {
  function withHands(self: string[], opp: string[]): GameState {
    const s = createEmptyGameState();
    return {
      ...s,
      players: {
        ...s.players,
        self: { ...s.players.self, hand: self },
        opp: { ...s.players.opp, hand: opp },
      },
    };
  }

  describe('handAtLeast', () => {
    it('境界 n-1 / n / n+1', () => {
      const s = withHands(['A', 'B', 'C'], []);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 2 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 3 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 4 }, makeCtx())).toBe(false);
    });
    it('手札0枚: n:0 は恒真、n:1 は false', () => {
      const s = withHands([], []);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 0 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 1 }, makeCtx())).toBe(false);
    });
    it('owner-relative: opp 所有カードの player:"self" は opp 手札を読む', () => {
      const s = withHands([], ['X', 'Y']);
      const ctx = makeCtx({ source: { player: 'opp', area: 'scene' } });
      expect(evalCond(s, { kind: 'handAtLeast', player: 'self', n: 2 }, ctx)).toBe(true);
      expect(evalCond(s, { kind: 'handAtLeast', player: 'opp', n: 1 }, ctx)).toBe(false);
    });
  });

  describe('handAtMost', () => {
    it('境界 n-1 / n / n+1 (「N枚以下」B07070/B07067 形)', () => {
      const s = withHands(['A', 'B'], []);
      expect(evalCond(s, { kind: 'handAtMost', player: 'self', n: 1 }, makeCtx())).toBe(false);
      expect(evalCond(s, { kind: 'handAtMost', player: 'self', n: 2 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtMost', player: 'self', n: 3 }, makeCtx())).toBe(true);
    });
    it('手札0枚は任意の n>=0 で true', () => {
      const s = withHands([], []);
      expect(evalCond(s, { kind: 'handAtMost', player: 'self', n: 0 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtMost', player: 'self', n: 2 }, makeCtx())).toBe(true);
    });
    it('相手手札 (B07100「相手の手札が4枚以下」形)', () => {
      const s = withHands([], ['A', 'B', 'C', 'D']);
      expect(evalCond(s, { kind: 'handAtMost', player: 'opp', n: 4 }, makeCtx())).toBe(true);
      expect(evalCond(s, { kind: 'handAtMost', player: 'opp', n: 3 }, makeCtx())).toBe(false);
    });
  });

  describe('handCountAtLeastOther', () => {
    it('B07067 a1「相手の手札が自分の手札の枚数以上」= player:"opp"', () => {
      expect(evalCond(withHands(['A'], ['X', 'Y']), { kind: 'handCountAtLeastOther', player: 'opp' }, makeCtx())).toBe(true);
      expect(evalCond(withHands(['A', 'B', 'C'], ['X']), { kind: 'handCountAtLeastOther', player: 'opp' }, makeCtx())).toBe(false);
    });
    it('同数は true (「以上」、Q&A: 両者0枚でも発火)', () => {
      expect(evalCond(withHands(['A'], ['X']), { kind: 'handCountAtLeastOther', player: 'opp' }, makeCtx())).toBe(true);
      expect(evalCond(withHands([], []), { kind: 'handCountAtLeastOther', player: 'opp' }, makeCtx())).toBe(true);
    });
  });
});

// Task D E2 (2026-06-12): triggerCharMatches.excludeSource
// rules: 19 (分割名で自己一致するカードの「このキャラ以外」除外、B09002 a1)
describe('triggerCharMatches excludeSource (Task D E2)', () => {
  it('payload.uid === ctx.source.uid のとき excludeSource:true なら false', () => {
    registerCardDef(defOf({ id: 'B09002', names: ['工藤新一&毛利蘭', '工藤新一', '毛利蘭'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'me', cardId: 'B09002' })]);
    const ctx = makeCtx({
      source: { player: 'self', area: 'scene', uid: 'me', cardId: 'B09002' },
      triggerPayload: { uid: 'me', player: 'self' },
    } as Partial<EffectCtx>);
    const cond = { kind: 'triggerCharMatches', side: 'self', filter: { cardName: ['工藤新一', '毛利蘭'] }, excludeSource: true } as never;
    expect(evalCond(s, cond, ctx), '自分自身の登場では発火しない').toBe(false);
    const condNoEx = { kind: 'triggerCharMatches', side: 'self', filter: { cardName: ['工藤新一', '毛利蘭'] } } as never;
    expect(evalCond(s, condNoEx, ctx), 'excludeSource 無しは従来通り true').toBe(true);
  });

  it('別キャラの登場なら excludeSource:true でも true', () => {
    registerCardDef(defOf({ id: 'B09002', names: ['工藤新一&毛利蘭', '工藤新一', '毛利蘭'] }));
    registerCardDef(defOf({ id: 'RAN', names: ['毛利蘭'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'me', cardId: 'B09002' }), makeChar({ uid: 'other', cardId: 'RAN' })]);
    const ctx = makeCtx({
      source: { player: 'self', area: 'scene', uid: 'me', cardId: 'B09002' },
      triggerPayload: { uid: 'other', player: 'self' },
    } as Partial<EffectCtx>);
    const cond = { kind: 'triggerCharMatches', side: 'self', filter: { cardName: ['工藤新一', '毛利蘭'] }, excludeSource: true } as never;
    expect(evalCond(s, cond, ctx)).toBe(true);
  });
});

// Task D E3 (2026-06-12): fileTopMatches / triggerPlayerIs
describe('fileTopMatches (Task D E3)', () => {
  it('FILE 最上位 (非パートナー) の kind を filter で判定 (B09021「1番上のカードがキャラの場合」)', () => {
    registerCardDef(defOf({ id: 'CHAR1', kind: 'character' }));
    registerCardDef(defOf({ id: 'EVT1', kind: 'event' }));
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, opp: { ...s.players.opp, file: [
      { type: 'card-back', cardId: 'EVT1' },
      { type: 'card-back', cardId: 'CHAR1', faceUp: true },
    ] } } };
    expect(evalCond(s, { kind: 'fileTopMatches', side: 'opp', filter: { kind: 'character' } } as never, makeCtx())).toBe(true);
    expect(evalCond(s, { kind: 'fileTopMatches', side: 'opp', filter: { kind: 'event' } } as never, makeCtx())).toBe(false);
  });

  it('FILE 空 / アシストパートナーのみ → false', () => {
    let s = createEmptyGameState();
    expect(evalCond(s, { kind: 'fileTopMatches', side: 'self', filter: { kind: 'character' } } as never, makeCtx())).toBe(false);
    s = { ...s, players: { ...s.players, self: { ...s.players.self, file: [{ type: 'assisted-partner', cardId: 'P1' }] } } };
    expect(evalCond(s, { kind: 'fileTopMatches', side: 'self', filter: { kind: 'character' } } as never, makeCtx())).toBe(false);
  });
});

describe('triggerPlayerIs (Task D E3)', () => {
  it('payload.player と source.player の一致/不一致 (B05050「FILEのカードを手札に加えたとき」)', () => {
    const s = createEmptyGameState();
    const ctxSelf = makeCtx({
      source: { player: 'self', area: 'scene', uid: 'u1' },
      triggerPayload: { player: 'self' },
    } as Partial<EffectCtx>);
    expect(evalCond(s, { kind: 'triggerPlayerIs', side: 'self' } as never, ctxSelf)).toBe(true);
    expect(evalCond(s, { kind: 'triggerPlayerIs', side: 'opp' } as never, ctxSelf)).toBe(false);
    const ctxOpp = makeCtx({
      source: { player: 'self', area: 'scene', uid: 'u1' },
      triggerPayload: { player: 'opp' },
    } as Partial<EffectCtx>);
    expect(evalCond(s, { kind: 'triggerPlayerIs', side: 'self' } as never, ctxOpp)).toBe(false);
    expect(evalCond(s, { kind: 'triggerPlayerIs', side: 'opp' } as never, ctxOpp)).toBe(true);
  });
});
