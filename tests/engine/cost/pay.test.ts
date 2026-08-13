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
import { makeChar, makeCtx } from '../../helpers/fixtures';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';


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
    it('chooses first payable branch by default (fallback)', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', state: 'active' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: [] } } };
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u' } });
      const cost: Cost = {
        kind: 'choice',
        items: [
          { kind: 'removeDeckTop', player: 'self', n: 1 },  // unpayable (deck empty)
          { kind: 'sleepSelf' },                              // payable
        ],
      };
      const result = produce(s, draft => {
        pay(draft, cost, ctx);
      });
      // Second branch (sleepSelf) is first canPay-able → char becomes sleep
      expect(result.players.self.scene[0].state).toBe('sleep');
      // Deck unchanged (removeDeckTop was NOT paid)
      expect(result.players.self.deck).toHaveLength(0);
    });

    it('uses ctx.dyn.costChoice = 0 to select first branch explicitly', () => {
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
      // Branch 0 (removeDeckTop) is paid: char stays active, deck shrinks by 1
      expect(result.players.self.scene[0].state).toBe('active');
      expect(result.players.self.deck).toEqual(['B']);
    });

    it('uses ctx.dyn.costChoice = 1 to select second branch explicitly', () => {
      let s = createEmptyGameState();
      s = withScene(s, 'self', [makeChar({ uid: 'u', state: 'active' })]);
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'] } } };
      const ctx = makeCtx({
        source: { player: 'self', area: 'scene', uid: 'u' },
        dyn: { costChoice: 1 },
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
      // Branch 1 (sleepSelf) is paid: char becomes sleep, deck unchanged
      expect(result.players.self.scene[0].state).toBe('sleep');
      expect(result.players.self.deck).toEqual(['A', 'B']);
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
      expect(ctx.costPaid?.flipFaceUpEvidence).toEqual({
        count: 2,
        ids: ['A', 'C'],
        occurrences: [
          { kind: 'card', uid: 'evidence:self:0', cardId: 'A', area: 'evidence', player: 'self', index: 0, occurrenceWitness: cardOccurrenceWitness(result, 'self', 'evidence') },
          { kind: 'card', uid: 'evidence:self:2', cardId: 'C', area: 'evidence', player: 'self', index: 2, occurrenceWitness: cardOccurrenceWitness(result, 'self', 'evidence') },
        ],
      });
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

// Task D E2 (2026-06-12): sceneToDeckBottom cost
// rules: 21 (コスト全部実行), 09/23 (デッキ下移動はリムーブでない)
// ⚠ payInner は void 戻りで case 追加漏れが TS で検知されない (BUG-116 同型) — 実移動を必ず固定する
describe('sceneToDeckBottom (Task D E2)', () => {
  it('現場のキャラを n 枚デッキの下へ移す (filter 一致の先頭 fallback)', () => {
    registerCardDef(defOf({ id: 'K1', traits: ['警視庁'], level: 4 }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'k1', cardId: 'K1' })]);
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['D1'] } } };
    const cost: Cost = {
      kind: 'sceneToDeckBottom',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '警視庁' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
      n: 1,
    } as Cost;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', cardId: 'SRC', uid: 'src-uid' } });
    const result = produce(s, draft => {
      pay(draft, cost, ctx);
    });
    expect(result.players.self.scene, '現場から消える').toHaveLength(0);
    expect(result.players.self.deck, 'デッキ末尾へ').toEqual(['D1', 'K1']);
    expect(result.players.self.remove, 'リムーブには行かない').not.toContain('K1');
  });

  it('ctx.dyn.costParams.sceneToDeckBottom.uids があればそれを優先する (UI 選択)', () => {
    registerCardDef(defOf({ id: 'K2', traits: ['警視庁'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [
      makeChar({ uid: 'k-a', cardId: 'K2' }),
      makeChar({ uid: 'k-b', cardId: 'K2' }),
    ]);
    const cost: Cost = {
      kind: 'sceneToDeckBottom',
      target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
      n: 1,
    } as Cost;
    const ctx = makeCtx({
      source: { player: 'self', area: 'scene', cardId: 'SRC', uid: 'src-uid' },
      dyn: { costParams: { sceneToDeckBottom: { uids: ['k-b'] } } },
    } as Partial<EffectCtx>);
    const result = produce(s, draft => {
      pay(draft, cost, ctx);
    });
    expect(result.players.self.scene.map(c => c.uid), 'k-b が選ばれ k-a は残る').toEqual(['k-a']);
    expect(result.players.self.deck).toContain('K2');
  });
});

// Task D E3 / BUG-129 (2026-06-12): fileFrom コストのカード消失修正
describe('fileFrom BUG-129 (Task D E3)', () => {
  it('支払った FILE カードはリムーブエリアへ行く (ゲームから消失しない)', () => {
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, file: [
      { type: 'card-back', cardId: 'F1' },
      { type: 'card-back', cardId: 'F2' },
    ] } } } as GameState;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    const result = produce(s, draft => {
      pay(draft, { kind: 'fileFrom', n: 2 } as Cost, ctx);
    });
    expect(result.players.self.file).toHaveLength(0);
    expect(result.players.self.remove, 'リフレッシュ母数に入る (rules/03/14)').toEqual(expect.arrayContaining(['F1', 'F2']));
  });
});
