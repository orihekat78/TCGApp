// engine.dyn.eval — Dyn evaluator tests
// spec: Phase 3 Group B Task 3.3

import { describe, it, expect, beforeEach } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { makeChar, makeCtx } from '../../helpers/fixtures';


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

    it('$self.sceneTrait.<trait> counts ctx.source.player scene chars with the trait (cutin scaling, D08007)', () => {
      registerCardDef(defOf({ id: 'STK', traits: ['少年探偵団'] }));
      registerCardDef(defOf({ id: 'OTH', traits: ['探偵'] }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 's1', cardId: 'STK' }),
        makeChar({ uid: 's2', cardId: 'STK' }),
        makeChar({ uid: 's3', cardId: 'OTH' }),
      ]);
      // cutin: source は手札カード (uid なし) でも player から自陣 scene を数える
      const ctx = makeCtx({ source: { player: 'self', area: 'hand', cardId: 'D08007', abilityId: 'a1' } });
      expect(evalDyn(s, '$self.sceneTrait.少年探偵団', ctx)).toBe(2);
      expect(evalDyn(s, '$self.sceneTrait.少年探偵団 * 1000', ctx)).toBe(2000);
    });

    it('$self.sceneTrait counts opp scene when source.player=opp; 0 when none', () => {
      registerCardDef(defOf({ id: 'STK', traits: ['少年探偵団'] }));
      const s = withScene(createEmptyGameState(), 'opp', [makeChar({ uid: 'o1', cardId: 'STK' })]);
      expect(evalDyn(s, '$self.sceneTrait.少年探偵団', makeCtx({ source: { player: 'opp', area: 'hand' } }))).toBe(1);
      expect(evalDyn(s, '$self.sceneTrait.少年探偵団', makeCtx({ source: { player: 'self', area: 'hand' } }))).toBe(0);
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

    // engine additive (session64): $self.setCardCount — このキャラに裏向き/表向きセットされた
    // カード枚数 (rules/16)。B05030 主眼「セットされているカード1枚につき AP+1000」用。
    it('$self.setCardCount counts this char\'s set cards (B05030 main ability)', () => {
      registerCardDef(defOf({ id: 'C001', ap: 5000 }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', setCards: [{ cardId: 'x', faceUp: false }, { cardId: 'y', faceUp: false }] }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.setCardCount', ctx)).toBe(2);
      expect(evalDyn(s, '$self.setCardCount * 1000', ctx)).toBe(2000);
    });

    it('$self.setCardCount is 0 when the char has no set cards', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.setCardCount', ctx)).toBe(0);
    });

    it('$self.setCardCount counts only the source char (not other chars, not stackedCards)', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', setCards: [{ cardId: 'x', faceUp: false }], stackedCards: 3 }),
        makeChar({ uid: 'u2', cardId: 'C001', setCards: [{ cardId: 'a', faceUp: false }, { cardId: 'b', faceUp: false }] }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      // u1 has 1 set card; u2's 2 set cards + u1's 3 stackedCards must NOT count.
      expect(evalDyn(s, '$self.setCardCount', ctx)).toBe(1);
    });

    it('$self.setCardCount counts set cards regardless of faceUp (表向き/裏向き両方)', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', setCards: [{ cardId: 'a', faceUp: true }, { cardId: 'b', faceUp: false }, { cardId: 'c', faceUp: true }] }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      // 「セットされているカード」は表向き/裏向きを問わず全て数える (rules/16)。
      expect(evalDyn(s, '$self.setCardCount', ctx)).toBe(3);
    });

    it('throws when $self.setCardCount requested with no uid', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$self.setCardCount', makeCtx())).toThrow(/source\.uid/);
    });

    // engine additive: $self.stackedCount — このキャラの下に重なっているカード枚数 (rules/16)。
    // B06006 a2「【自分ターン中】このキャラの下に重なっているカード1枚につき AP+1000」用。
    // ⚠ stackedCards は number field (setCards: SetCardEntry[] とは別フィールド = 重ね≠セット rules/16)。
    it('$self.stackedCount counts this char\'s stacked cards (B06006 a2)', () => {
      registerCardDef(defOf({ id: 'C001', ap: 4000 }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', stackedCards: 2 }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.stackedCount', ctx)).toBe(2);
      expect(evalDyn(s, '$self.stackedCount * 1000', ctx)).toBe(2000);
    });

    it('$self.stackedCount is 0 when the char has no stacked cards', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      expect(evalDyn(s, '$self.stackedCount', ctx)).toBe(0);
    });

    it('$self.stackedCount counts only the source char (not other chars, not setCards)', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001', stackedCards: 1, setCards: [{ cardId: 'x', faceUp: false }, { cardId: 'y', faceUp: false }] }),
        makeChar({ uid: 'u2', cardId: 'C001', stackedCards: 5 }),
      ]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      // u1 has 1 stacked card; u2's 5 stackedCards + u1's 2 setCards must NOT count.
      expect(evalDyn(s, '$self.stackedCount', ctx)).toBe(1);
    });

    it('throws when $self.stackedCount requested with no uid', () => {
      const s = createEmptyGameState();
      expect(() => evalDyn(s, '$self.stackedCount', makeCtx())).toThrow(/source\.uid/);
    });

    // engine additive (2026-06-29): $self.oppSceneCount — 相手の現場キャラ枚数 (B08086 テキーラ)。
    // player ベース (uid 要件より前)、フィルタ無し総数、現場のみ。
    it('$self.oppSceneCount counts opponent scene chars, NOT own scene (B08086)', () => {
      registerCardDef(defOf({ id: 'C001', ap: 0 }));
      let s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001' }),
        makeChar({ uid: 'u2', cardId: 'C001' }),
        makeChar({ uid: 'u3', cardId: 'C001' }),
      ]);
      s = withScene(s, 'opp', [makeChar({ uid: 'o1', cardId: 'C001' }), makeChar({ uid: 'o2', cardId: 'C001' })]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
      // DECOY: bearer's own 3 chars must NOT count (the false-green a naive $self.sceneCount would produce)
      expect(evalDyn(s, '$self.oppSceneCount', ctx)).toBe(2);
      expect(evalDyn(s, '$self.oppSceneCount * 2000', ctx)).toBe(4000);
    });

    it('$self.oppSceneCount resolves opponent relative to source.player (not hardcoded opp)', () => {
      registerCardDef(defOf({ id: 'C001' }));
      let s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' }), makeChar({ uid: 'u2', cardId: 'C001' })]);
      s = withScene(s, 'opp', [makeChar({ uid: 'o1', cardId: 'C001' })]);
      // bearer on opp scene → opponent = self → counts self.scene (2)
      expect(evalDyn(s, '$self.oppSceneCount', makeCtx({ source: { player: 'opp', area: 'scene', uid: 'o1' } }))).toBe(2);
      // bearer on self scene → opponent = opp → counts opp.scene (1)
      expect(evalDyn(s, '$self.oppSceneCount', makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } }))).toBe(1);
    });

    it('$self.oppSceneCount is 0 when opponent scene is empty', () => {
      registerCardDef(defOf({ id: 'C001' }));
      const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'u1', cardId: 'C001' })]);
      expect(evalDyn(s, '$self.oppSceneCount', makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } }))).toBe(0);
    });

    it('$self.sceneCount counts the source owner scene and composes with opponent count', () => {
      registerCardDef(defOf({ id: 'C001' }));
      let s = withScene(createEmptyGameState(), 'self', [
        makeChar({ uid: 'u1', cardId: 'C001' }),
        makeChar({ uid: 'u2', cardId: 'C001' }),
      ]);
      s = withScene(s, 'opp', [makeChar({ uid: 'o1', cardId: 'C001' })]);

      const selfCtx = makeCtx({ source: { player: 'self', area: 'hand' } });
      const oppCtx = makeCtx({ source: { player: 'opp', area: 'hand' } });
      expect(evalDyn(s, '$self.sceneCount', selfCtx)).toBe(2);
      expect(evalDyn(s, '$self.sceneCount', oppCtx)).toBe(1);
      expect(evalDyn(s, '($self.sceneCount + $self.oppSceneCount) * 2', selfCtx)).toBe(6);
      expect(evalDyn(createEmptyGameState(), '$self.sceneCount', selfCtx)).toBe(0);
    });

    // engine additive wave (2026-07-02): $self.removeNameCount.<name> — ctx.source.player の
    // リムーブエリアで指定カード名を持つカード数 (PR158/PR164 犯人 カットイン「〚カード名［犯人］〛1枚につき AP+2000
    // （このカードも含める）」)。カットイン自身は resolve 時点で既に remove 内 (contact.ts emit→discardToRemove→resolve)
    // ゆえ自然に計数される。名前一致は分割名component (rules/19)。カットインは ctx.source.uid 無 → player ベース。
    it('$self.removeNameCount counts named cards in own remove area (PR158 犯人, includes self already in remove)', () => {
      registerCardDef(defOf({ id: '0627', names: ['犯人'] }));
      registerCardDef(defOf({ id: 'DECOY', names: ['灰原哀'] }));
      const s = createEmptyGameState();
      // 犯人 ×3 (使用中カットイン自身が remove へ移動済 を含む), 別名 decoy ×2 は数えない
      s.players.self.remove = ['0627', 'DECOY', '0627', 'DECOY', '0627'];
      s.players.opp.remove = ['0627', '0627']; // 相手の remove は数えない (自分の限定)
      const ctx = makeCtx({ source: { player: 'self', area: 'scene' } }); // カットインは uid 無
      expect(evalDyn(s, '$self.removeNameCount.犯人', ctx)).toBe(3);
      expect(evalDyn(s, '$self.removeNameCount.犯人 * 2000', ctx)).toBe(6000);
    });

    it('$self.removeNameCount resolves side relative to source.player + name-component match (rules/19)', () => {
      registerCardDef(defOf({ id: 'SPLIT', names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'] }));
      const s = createEmptyGameState();
      s.players.opp.remove = ['SPLIT', 'SPLIT'];
      // bearer on opp side → 自分の remove = opp.remove、分割名 [工藤新一] で一致
      expect(evalDyn(s, '$self.removeNameCount.工藤新一', makeCtx({ source: { player: 'opp', area: 'scene' } }))).toBe(2);
      // self side は remove 空 → 0
      expect(evalDyn(s, '$self.removeNameCount.工藤新一', makeCtx({ source: { player: 'self', area: 'scene' } }))).toBe(0);
    });

    it('$self.removeNameCount is 0 when remove area has no matching name', () => {
      registerCardDef(defOf({ id: 'DECOY', names: ['灰原哀'] }));
      const s = createEmptyGameState();
      s.players.self.remove = ['DECOY'];
      expect(evalDyn(s, '$self.removeNameCount.犯人', makeCtx({ source: { player: 'self', area: 'scene' } }))).toBe(0);
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
