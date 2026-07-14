// engine.target.candidates / legalCount — tests
// spec: Phase 3 Group B Task 3.4

import { describe, it, expect, beforeEach } from 'vitest';
import { candidates, legalCount } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type {
  GameState,
  SceneCharacter,
  CardDef,
  TargetingRef,
  TargetQuery,
  Candidate,
  AbilityDef,
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

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: { ...s.players, [p]: { ...s.players[p], scene: chars } },
  };
}

function pickRef(query: TargetQuery, nMin = 1, nMax = 1): TargetingRef {
  return { kind: 'pick', query, n: { min: nMin, max: nMax }, chooser: 'owner' };
}

describe('engine.target.candidates', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('kind: self', () => {
    it('returns the SceneCharacter for ctx.source.uid', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      const result = candidates(s, { kind: 'self' }, ctx);
      expect(result).toEqual([{ kind: 'char', uid: 'u1', cardId: 'C001', player: 'self' }]);
    });

    it('returns [] when no uid in ctx', () => {
      const s = createEmptyGameState();
      const result = candidates(s, { kind: 'self' }, makeCtx());
      expect(result).toEqual([]);
    });
  });

  describe('kind: fromBound', () => {
    it('returns ctx.bindings[bindKey]', () => {
      const s = createEmptyGameState();
      const bound: Candidate[] = [{ kind: 'char', uid: 'x', cardId: 'C', player: 'self' }];
      const ctx = makeCtx({ bindings: { mykey: bound } });
      const result = candidates(s, { kind: 'fromBound', bindKey: 'mykey' }, ctx);
      expect(result).toEqual(bound);
    });
  });

  describe('scene area + side', () => {
    it('side: self → only own scene', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
      s = withScene(s, 'opp', [makeChar({ uid: 'b' })]);
      const result = candidates(s, pickRef({ side: 'self' }), makeCtx());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ kind: 'char', uid: 'a', player: 'self' });
    });

    it('side: opp → only opp scene', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
      s = withScene(s, 'opp', [makeChar({ uid: 'b' })]);
      const result = candidates(s, pickRef({ side: 'opp' }), makeCtx());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ kind: 'char', uid: 'b', player: 'opp' });
    });

    it('side: either → both scenes', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
      s = withScene(s, 'opp', [makeChar({ uid: 'b' })]);
      const result = candidates(s, pickRef({ side: 'either' }), makeCtx());
      expect(result).toHaveLength(2);
    });

    it('side defaults to either', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
      s = withScene(s, 'opp', [makeChar({ uid: 'b' })]);
      const result = candidates(s, pickRef({}), makeCtx());
      expect(result).toHaveLength(2);
    });
  });

  describe('filter (AND)', () => {
    it('filters by trait', () => {
      registerCardDef(defOf({ id: 'A', traits: ['少年探偵団'] }));
      registerCardDef(defOf({ id: 'B', traits: ['警察'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'B' }),
      ]);
      const result = candidates(s, pickRef({ side: 'self', filter: { trait: '少年探偵団' } }), makeCtx());
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('a');
    });

    it('filters by color and trait (AND)', () => {
      registerCardDef(defOf({ id: 'A', traits: ['少年探偵団'], colors: ['赤'] }));
      registerCardDef(defOf({ id: 'B', traits: ['少年探偵団'], colors: ['青'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'B' }),
      ]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filter: { trait: '少年探偵団', color: '赤' } }),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('a');
    });
  });

  describe('keyword filter — icon abilities (BUG-122)', () => {
    // アイコン能力 (カットイン/変装/ヒラメキ/ミスリード) は keywords[] に入らず ability 構造で表現される。
    // filter.keyword:'カットイン' は keywords[] のみでなく ability も見て一致させる (B05112 repro)。
    const cutinAbility: AbilityDef = {
      id: 'cut',
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true },
      description: 'カットイン AP+2000',
    };

    it("matches a card whose カットイン is an ability (not in keywords[])", () => {
      registerCardDef(defOf({ id: 'CUT', colors: ['黒'], level: 4, keywords: [], abilities: [cutinAbility] }));
      registerCardDef(defOf({ id: 'PLAIN', colors: ['黒'], level: 4, keywords: [] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['CUT', 'PLAIN'] } } };
      const result = candidates(
        s,
        pickRef({ area: 'hand', side: 'self', filter: { keyword: 'カットイン', levelMax: 5, color: '黒' } }, 0, 1),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
      expect((result[0] as { cardId: string }).cardId).toBe('CUT');
    });

    it('still matches normal keywords via keywords[] (迅速)', () => {
      registerCardDef(defOf({ id: 'SWIFT', keywords: ['迅速'] }));
      registerCardDef(defOf({ id: 'NONE', keywords: [] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'SWIFT' }),
        makeChar({ uid: 'b', cardId: 'NONE' }),
      ]);
      const result = candidates(s, pickRef({ side: 'self', filter: { keyword: '迅速' } }), makeCtx());
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('a');
    });
  });

  describe('filterAny (OR)', () => {
    it('matches if any filter matches', () => {
      registerCardDef(defOf({ id: 'A', traits: ['警察'] }));
      registerCardDef(defOf({ id: 'B', traits: ['探偵'] }));
      registerCardDef(defOf({ id: 'C', traits: ['犯人'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'B' }),
        makeChar({ uid: 'c', cardId: 'C' }),
      ]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filterAny: [{ trait: '警察' }, { trait: '探偵' }] }),
        makeCtx(),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('excludeSelf', () => {
    it('drops the source uid char', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a' }),
        makeChar({ uid: 'b' }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'a' } });
      const result = candidates(s, pickRef({ side: 'self', excludeSelf: true }), ctx);
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('b');
    });
  });

  describe('excludeBound', () => {
    it('drops every scene character uid recorded in the named binding', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'entered' }),
        makeChar({ uid: 'other' }),
      ]);
      const ctx = makeCtx({
        bindings: { entered: [{ kind: 'char', uid: 'entered', cardId: 'C', player: 'self' }] },
      });
      const result = candidates(s, pickRef({ side: 'self', excludeBound: 'entered' }), ctx);
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('other');
    });

    it('fails closed when the binding is missing', () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'only' })]);
      expect(candidates(s, pickRef({ side: 'self', excludeBound: 'missing' }), makeCtx())).toEqual([]);
    });
  });

  describe('state filter', () => {
    it('filters by sleep/stun', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', state: 'active' }),
        makeChar({ uid: 'b', state: 'sleep' }),
        makeChar({ uid: 'c', state: 'stun' }),
      ]);
      const result = candidates(s, pickRef({ side: 'self', state: ['sleep', 'stun'] }), makeCtx());
      expect(result).toHaveLength(2);
    });
  });

  describe('named filter', () => {
    it('named: true → only named', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', isNamed: true }),
        makeChar({ uid: 'b', isNamed: false }),
      ]);
      const result = candidates(s, pickRef({ side: 'self', named: true }), makeCtx());
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('a');
    });

    it('named: false → only non-named', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', isNamed: true }),
        makeChar({ uid: 'b', isNamed: false }),
      ]);
      const result = candidates(s, pickRef({ side: 'self', named: false }), makeCtx());
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('b');
    });
  });

  describe('cardName split-name match (rules/19)', () => {
    it('matches split-name card by component', () => {
      // 江戸川コナン&工藤新一 should match cardName: '江戸川コナン'
      registerCardDef(defOf({
        id: 'SPLIT',
        names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'],
      }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'SPLIT' })]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filter: { cardName: '江戸川コナン' } }),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
    });

    it('matches split-name from & alone (auto-split)', () => {
      registerCardDef(defOf({
        id: 'AUTO',
        names: ['江戸川コナン&工藤新一'],
      }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'AUTO' })]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filter: { cardName: '工藤新一' } }),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('hand area', () => {
    it('enumerates hand cards', () => {
      registerCardDef(defOf({ id: 'H1', traits: ['少年探偵団'] }));
      registerCardDef(defOf({ id: 'H2', traits: ['警察'] }));
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['H1', 'H2', 'H1'] } } };
      const result = candidates(
        s,
        pickRef({ area: 'hand', side: 'self', filter: { trait: '少年探偵団' } }, 1, 3),
        makeCtx(),
      );
      expect(result).toHaveLength(2);
      expect((result[0] as { area: string }).area).toBe('hand');
    });
  });

  describe('numeric filters', () => {
    it('apMin/apMax', () => {
      registerCardDef(defOf({ id: 'A', ap: 3000 }));
      registerCardDef(defOf({ id: 'B', ap: 5000 }));
      registerCardDef(defOf({ id: 'C', ap: 8000 }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'B' }),
        makeChar({ uid: 'c', cardId: 'C' }),
      ]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filter: { apMin: 4000, apMax: 7000 } }),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
      expect((result[0] as { uid: string }).uid).toBe('b');
    });

    it('apOverride takes precedence', () => {
      registerCardDef(defOf({ id: 'A', ap: 3000 }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'A', apOverride: 9999 })]);
      const result = candidates(
        s,
        pickRef({ side: 'self', filter: { apMin: 5000 } }),
        makeCtx(),
      );
      expect(result).toHaveLength(1);
    });
  });
});

describe('engine.target.legalCount', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it('self → {1, 1}', () => {
    const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u' })]);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
    expect(legalCount(s, { kind: 'self' }, ctx)).toEqual({ min: 1, max: 1 });
  });

  it('pick: candidates < ref.n.max → max collapses', () => {
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
    const ref = pickRef({ side: 'self' }, 1, 3);
    expect(legalCount(s, ref, makeCtx())).toEqual({ min: 1, max: 1 });
  });

  it('pick "N枚まで" with 0 candidates → max=0', () => {
    const s = createEmptyGameState();
    const ref = pickRef({ side: 'self' }, 0, 3);
    expect(legalCount(s, ref, makeCtx())).toEqual({ min: 0, max: 0 });
  });

  it('all → {count, count}', () => {
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'a' }), makeChar({ uid: 'b' })]);
    const ref: TargetingRef = { kind: 'all', query: { side: 'self' } };
    expect(legalCount(s, ref, makeCtx())).toEqual({ min: 2, max: 2 });
  });

  it('fromBound → bound.length', () => {
    const s = createEmptyGameState();
    const bound: Candidate[] = [
      { kind: 'char', uid: 'x', cardId: 'C', player: 'self' },
      { kind: 'char', uid: 'y', cardId: 'D', player: 'self' },
    ];
    const ctx = makeCtx({ bindings: { k: bound } });
    expect(legalCount(s, { kind: 'fromBound', bindKey: 'k' }, ctx)).toEqual({ min: 2, max: 2 });
  });
});
