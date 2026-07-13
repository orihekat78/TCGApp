// engine.target.resolve — tests
// spec: Phase 3 Group B Task 3.4

import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from '@/engine/target/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type {
  GameState,
  SceneCharacter,
  CardDef,
  TargetingRef,
  TargetQuery,
  Candidate,
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

describe('engine.target.resolve', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('auto-resolve', () => {
    it("'self' auto-resolves regardless of picked", () => {
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const result = resolve(s, { kind: 'self' }, ctx);
      expect(result).toHaveLength(1);
    });

    it("'all' auto-resolves", () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' }), makeChar({ uid: 'b' })]);
      const result = resolve(s, { kind: 'all', query: { side: 'self' } }, makeCtx());
      expect(result).toHaveLength(2);
    });

    it("'fromBound' auto-resolves", () => {
      const s = createEmptyGameState();
      const bound: Candidate[] = [{ kind: 'char', uid: 'x', cardId: 'C', player: 'self' }];
      const ctx = makeCtx({ bindings: { k: bound } });
      expect(resolve(s, { kind: 'fromBound', bindKey: 'k' }, ctx)).toEqual(bound);
    });
  });

  describe('pick', () => {
    it('valid pick passes', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'C1' })]);
      const ref = pickRef({ side: 'self' }, 1, 1);
      const picked: Candidate[] = [{ kind: 'char', uid: 'a', cardId: 'C1', player: 'self' }];
      const result = resolve(s, ref, makeCtx(), picked);
      expect(result).toEqual(picked);
    });

    it('throws when picked missing', () => {
      const s = createEmptyGameState();
      const ref = pickRef({ side: 'self' }, 1, 1);
      expect(() => resolve(s, ref, makeCtx())).toThrow(/picked is required/);
    });

    it('throws on invalid pick (not in candidates)', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a', cardId: 'C1' })]);
      const ref = pickRef({ side: 'self' }, 1, 1);
      const picked: Candidate[] = [{ kind: 'char', uid: 'NOT_REAL', cardId: 'X', player: 'self' }];
      expect(() => resolve(s, ref, makeCtx(), picked)).toThrow(/not in available/);
    });

    it('throws when too many picked', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'C1' }),
        makeChar({ uid: 'b', cardId: 'C2' }),
      ]);
      const ref = pickRef({ side: 'self' }, 1, 1);
      const picked: Candidate[] = [
        { kind: 'char', uid: 'a', cardId: 'C1', player: 'self' },
        { kind: 'char', uid: 'b', cardId: 'C2', player: 'self' },
      ];
      expect(() => resolve(s, ref, makeCtx(), picked)).toThrow(/out of legal range/);
    });

    it('rejects a multi-pick whose combined printed levels exceed aggregateLevelMax', () => {
      registerCardDef(defOf({ id: 'LV6', level: 6 }));
      registerCardDef(defOf({ id: 'LV5', level: 5 }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'lv6', cardId: 'LV6' }),
        makeChar({ uid: 'lv5', cardId: 'LV5' }),
      ]);
      const ref = pickRef({ side: 'self', aggregateLevelMax: 10 } as TargetQuery, 0, 2);
      const picked: Candidate[] = [
        { kind: 'char', uid: 'lv6', cardId: 'LV6', player: 'self' },
        { kind: 'char', uid: 'lv5', cardId: 'LV5', player: 'self' },
      ];

      expect(() => resolve(s, ref, makeCtx(), picked)).toThrow(/aggregateLevelMax/);
    });

    it('throws when too few picked (enough candidates available)', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'C1' }),
        makeChar({ uid: 'b', cardId: 'C2' }),
      ]);
      const ref = pickRef({ side: 'self' }, 2, 2);
      const picked: Candidate[] = [{ kind: 'char', uid: 'a', cardId: 'C1', player: 'self' }];
      expect(() => resolve(s, ref, makeCtx(), picked)).toThrow(/out of legal range/);
    });

    it('"N枚まで" with 0 picks allowed', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'a' })]);
      const ref = pickRef({ side: 'self' }, 0, 3);
      const result = resolve(s, ref, makeCtx(), []);
      expect(result).toEqual([]);
    });
  });

  describe('distinctNames (rules/19)', () => {
    it('throws when two picks share card-name component', () => {
      registerCardDef(defOf({
        id: 'SPLIT',
        names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'],
      }));
      registerCardDef(defOf({
        id: 'CONAN',
        names: ['江戸川コナン'],
      }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'SPLIT' }),
        makeChar({ uid: 'b', cardId: 'CONAN' }),
      ]);
      const ref: TargetingRef = {
        kind: 'pick',
        query: { side: 'self', distinctNames: true },
        n: { min: 2, max: 2 },
        chooser: 'owner',
      };
      const picked: Candidate[] = [
        { kind: 'char', uid: 'a', cardId: 'SPLIT', player: 'self' },
        { kind: 'char', uid: 'b', cardId: 'CONAN', player: 'self' },
      ];
      expect(() => resolve(s, ref, makeCtx(), picked)).toThrow(/distinctNames/);
    });

    it('allows two picks with disjoint names', () => {
      registerCardDef(defOf({ id: 'A', names: ['毛利蘭'] }));
      registerCardDef(defOf({ id: 'B', names: ['服部平次'] }));
      let s = createEmptyGameState();
      s = withScene(s, 'self', [
        makeChar({ uid: 'a', cardId: 'A' }),
        makeChar({ uid: 'b', cardId: 'B' }),
      ]);
      const ref: TargetingRef = {
        kind: 'pick',
        query: { side: 'self', distinctNames: true },
        n: { min: 2, max: 2 },
        chooser: 'owner',
      };
      const picked: Candidate[] = [
        { kind: 'char', uid: 'a', cardId: 'A', player: 'self' },
        { kind: 'char', uid: 'b', cardId: 'B', player: 'self' },
      ];
      const result = resolve(s, ref, makeCtx(), picked);
      expect(result).toEqual(picked);
    });
  });
});
