// engine.dyn.eval — Dyn evaluator tests
// spec: Phase 3 Group B Task 3.3

import { describe, it, expect, beforeEach } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { EffectCtx, GameState, SceneCharacter, CardDef } from '@/engine/types';

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

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: {
      ...s.players,
      [p]: { ...s.players[p], scene: chars },
    },
  };
}

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id,
    no: overrides.no ?? 'NO',
    kind: 'character',
    names: ['default-name'],
    colors: [],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

describe('engine.dyn.eval', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe('passthrough', () => {
    it('returns numbers as-is', () => {
      const s = createEmptyGameState();
      expect(evalDyn(s, 42, makeCtx())).toBe(42);
    });

    it('returns booleans as-is', () => {
      const s = createEmptyGameState();
      expect(evalDyn(s, true, makeCtx())).toBe(true);
    });

    it('returns plain strings (no $) as-is', () => {
      const s = createEmptyGameState();
      expect(evalDyn(s, 'hello', makeCtx())).toBe('hello');
    });
  });

  describe('$self', () => {
    it('$self.ap evaluates current AP via read API', () => {
      registerCardDef(defOf({ id: 'C001', ap: 3000, lp: 2000 }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.ap', ctx)).toBe(3000);
    });

    it('$self.lp evaluates current LP', () => {
      registerCardDef(defOf({ id: 'C001', ap: 3000, lp: 2000 }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.lp', ctx)).toBe(2000);
    });

    it('$self.uid returns ctx.source.uid', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'XYZ' } });
      expect(evalDyn(s, '$self.uid', ctx)).toBe('XYZ');
    });

    it('throws when $self.ap requested with no uid', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$self.ap', makeCtx())).toThrow(/source\.uid/);
    });

    it('apOverride respected (e.g. set by charSetAP)', () => {
      registerCardDef(defOf({ id: 'C001', ap: 3000 }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', apOverride: 9999 }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.ap', ctx)).toBe(9999);
    });
  });

  describe('$contact', () => {
    it('$contact.byUid returns ctx.contact.byUid', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({
        contact: { byUid: 'A', targetUid: 'B', attackerSide: 'self' },
      });
      expect(evalDyn(s, '$contact.byUid', ctx)).toBe('A');
    });

    it('$contact.targetUid returns ctx.contact.targetUid', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({
        contact: { byUid: 'A', targetUid: 'B', attackerSide: 'self' },
      });
      expect(evalDyn(s, '$contact.targetUid', ctx)).toBe('B');
    });

    it('$contact.attackerSide returns side', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({
        contact: { byUid: 'A', targetUid: 'B', attackerSide: 'opp' },
      });
      expect(evalDyn(s, '$contact.attackerSide', ctx)).toBe('opp');
    });

    it('throws when contact missing', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$contact.byUid', makeCtx())).toThrow(/ctx\.contact/);
    });
  });

  describe('$cost', () => {
    it('$cost.flipFaceUpEvidence.count from costPaid', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({
        costPaid: { flipFaceUpEvidence: { count: 2 } },
      });
      expect(evalDyn(s, '$cost.flipFaceUpEvidence.count', ctx)).toBe(2);
    });

    it('throws when cost path missing', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ costPaid: {} });
      expect(() => evalDyn(s, '$cost.flipFaceUpEvidence.count', ctx)).toThrow(/undefined/);
    });
  });

  describe('$dyn', () => {
    it('$dyn.X returns ctx.dyn[X]', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { foo: 5 } });
      expect(evalDyn(s, '$dyn.foo', ctx)).toBe(5);
    });

    it('throws on missing key', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: {} });
      expect(() => evalDyn(s, '$dyn.missing', ctx)).toThrow(/undefined/);
    });
  });

  describe('arithmetic', () => {
    it('$dyn.X * 1000 multiplies', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { x: 3 } });
      expect(evalDyn(s, '$dyn.x * 1000', ctx)).toBe(3000);
    });

    it('$self.ap + 100 adds', () => {
      registerCardDef(defOf({ id: 'C001', ap: 200 }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.ap + 100', ctx)).toBe(300);
    });

    it('standard precedence: * binds tighter than + (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 10 } });
      // Cleanup Phase #1 (2026-05-22): 標準 precedence に変更
      // 10 + 2 * 3 → 10 + (2*3) = 16
      expect(evalDyn(s, '$dyn.a + 2 * 3', ctx)).toBe(16);
    });

    it('parentheses override precedence (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 10 } });
      // (10 + 2) * 3 = 36
      expect(evalDyn(s, '($dyn.a + 2) * 3', ctx)).toBe(36);
    });

    it('nested parentheses + precedence (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 4, b: 2 } });
      // 2 * (4 + 2 * 3) = 2 * (4 + 6) = 20
      expect(evalDyn(s, '$dyn.b * ($dyn.a + 2 * 3)', ctx)).toBe(20);
    });

    it('division/modulo precedence (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 20, m: 10 } });
      // 20 / 4 + 1 = 5 + 1 = 6 (not 20 / (4+1) = 4)
      expect(evalDyn(s, '$dyn.a / 4 + 1', ctx)).toBe(6);
      // 10 % 3 * 2 = 1 * 2 = 2 (same precedence, left-to-right)
      expect(evalDyn(s, '$dyn.m % 3 * 2', ctx)).toBe(2);
    });

    it('unary minus inside parens (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 5 } });
      // (-3 + $dyn.a) * 2 = (5 + -3) * 2 = 4
      expect(evalDyn(s, '(-3 + $dyn.a) * 2', ctx)).toBe(4);
    });

    it('unmatched paren throws (Cleanup Phase #1)', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 1 } });
      expect(() => evalDyn(s, '($dyn.a + 1', ctx)).toThrow(/unmatched/);
      expect(() => evalDyn(s, '$dyn.a + 1)', ctx)).toThrow(/unmatched/);
    });

    it('handles whitespace', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { a: 4 } });
      expect(evalDyn(s, '$dyn.a  *  10', ctx)).toBe(40);
    });

    it('leading negative literal: -3 * $dyn.x', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { x: 4 } });
      // -3 * 4 = -12 (left-to-right)
      expect(evalDyn(s, '-3 * $dyn.x', ctx)).toBe(-12);
    });

    it('inline negative literal: $dyn.x + -1', () => {
      const s = createEmptyGameState();
      const ctx = makeCtx({ dyn: { x: 10 } });
      // 10 + (-1) = 9
      expect(evalDyn(s, '$dyn.x + -1', ctx)).toBe(9);
    });
  });

  describe('$pick', () => {
    it('throws "not evaluable here" for $pick', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$pick', makeCtx())).toThrow(/\$pick is not evaluable here/);
    });
  });

  describe('unknown roots', () => {
    it('throws on unknown $foo root', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$foo.bar', makeCtx())).toThrow(/unknown placeholder root/);
    });
  });

  describe('security', () => {
    it('rejects arbitrary characters not in grammar', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$dyn.a ; alert(1)', makeCtx({ dyn: { a: 1 } }))).toThrow();
    });
  });
});
