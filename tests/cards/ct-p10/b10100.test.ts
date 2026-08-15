import { describe, expect, it } from 'vitest';
import { B10100, B10100P } from '@/cards/ct-p10/B10100';
import { REUSE_CARDS } from '@/cards';
import { canPayAtomically, pay } from '@/engine/cost/pay';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Cost, EffectCtx } from '@/engine/types';

const ctx = (indices: number[], evidenceIndices: number[] = [0]): EffectCtx => ({
  source: { player: 'self', uid: 'case:self', cardId: B10100.id, abilityId: 'a2', area: 'case' },
  bindings: {}, dyn: { costParams: { flipFaceUpEvidence: { indices: evidenceIndices }, removeFromHand: { indices } } },
});

describe('B10100 工藤新一NYの事件', () => {
  it('keeps official metadata, P equivalence, zero-pick grant, and both granted texts', () => {
    expect(B10100).toMatchObject({ id: 'B10100', no: '1155/B10100', kind: 'case', names: ['工藤新一NYの事件'], colors: ['青', '黒'], caseLevel: 7, rarity: 'R', imageUrl: '1783904247209660.jpg' });
    expect(B10100P).toMatchObject({ id: 'B10100P', no: '1155/B10100P', rarity: 'RP', imageUrl: '1783904247219311.jpg' });
    expect(B10100P.abilities).toEqual(B10100.abilities);
    expect(REUSE_CARDS.filter(card => card.id === B10100.id || card.id === B10100P.id)).toEqual([B10100, B10100P]);
    expect(new Set(REUSE_CARDS.map(card => card.id)).size).toBe(REUSE_CARDS.length);
    const a2 = B10100.abilities[1]!;
    expect(a2).toMatchObject({ type: 'declared', scope: 'always', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 } });
    expect(a2.cost).toMatchObject({ kind: 'pay', items: [{ kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } }, { kind: 'removeFromHand', n: 1 }] });
    const steps = (a2.effect as { steps: Array<{ args: Record<string, unknown> }> }).steps;
    expect(steps[0]!.args).toMatchObject({ max: 1, filter: { cardName: ['工藤新一', '毛利蘭'] }, bind: '$picked' });
    expect(steps[1]!.args).toMatchObject({ uid: '$picked.uid' });
    expect((steps[0]!.args.ability as { trigger: { hook: string }; effect: { args: unknown } }).trigger.hook).toBe('action:pre-target');
    expect((steps[1]!.args.ability as { trigger: { hook: string }; condition: unknown }).trigger.hook).toBe('leave:to-remove');
  });

  it('uses exact hand occurrences and leaves the composite cost atomic on invalid witnesses', () => {
    const cost = B10100.abilities[1]!.cost as Cost;
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 1, via: 'opening' } });
    s.players.self.hand = ['A', 'B', 'A'];
    expect(canPayAtomically(s, cost, ctx([2]))).toBe(true);
    pay(s, cost, ctx([2]));
    expect(s.players.self.hand).toEqual(['A', 'B']);
    expect(s.players.self.remove).toEqual(['A']);
    expect(s.players.self.evidence[0]!.faceUp).toBe(true);

    const invalid = createEmptyGameState();
    invalid.players.self.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 1, via: 'opening' } });
    invalid.players.self.hand = ['A'];
    expect(canPayAtomically(invalid, cost, ctx([1]))).toBe(false);
    expect(() => pay(invalid, cost, ctx([1]))).toThrow();
    expect(invalid.players.self.hand).toEqual(['A']);
    expect(invalid.players.self.evidence[0]!.faceUp).toBe(false);
  });

  it('rejects duplicate, stale, and opponent-hand witnesses before either composite item mutates', () => {
    const cost = B10100.abilities[1]!.cost as Cost;
    const fresh = () => {
      const s = createEmptyGameState();
      s.players.self.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 1, via: 'opening' } });
      s.players.self.hand = ['SELF'];
      s.players.opp.hand = ['OPP'];
      return s;
    };
    for (const indices of [[0, 0], [4]]) {
      const s = fresh();
      expect(canPayAtomically(s, cost, ctx(indices))).toBe(false);
      expect(s.players.self.evidence[0]!.faceUp).toBe(false);
      expect(s.players.self.remove).toEqual([]);
    }
    const opponentOnly = fresh();
    opponentOnly.players.self.hand = [];
    expect(canPayAtomically(opponentOnly, cost, ctx([0]))).toBe(false);
    expect(opponentOnly.players.self.evidence[0]!.faceUp).toBe(false);
    expect(opponentOnly.players.opp.hand).toEqual(['OPP']);
  });

  it('flips any exact own evidence occurrence without reordering and never spends opponent evidence', () => {
    const cost = B10100.abilities[1]!.cost as Cost;
    const own = createEmptyGameState();
    own.players.self.evidence = ['E0', 'E1', 'E2'].map(cardId => ({ cardId, faceUp: false, origin: { turn: 1, via: 'opening' as const } }));
    own.players.self.hand = ['PAY'];
    pay(own, cost, ctx([0], [2]));

    // qa: card:B10100:fa86da58031fb9ac89e29ca33154f7e33fdfcb57011d4dc5c56f55e70a74939f
    expect(own.players.self.evidence.map(item => [item.cardId, item.faceUp])).toEqual([['E0', false], ['E1', false], ['E2', true]]);

    const opponentOnly = createEmptyGameState();
    opponentOnly.players.self.hand = ['PAY'];
    opponentOnly.players.opp.evidence = [{ cardId: 'OPP', faceUp: false, origin: { turn: 1, via: 'opening' } }];
    // qa: card:B10100:5ec9d86e896c25749cf5aab043bd9fa0c92af21362e720fe60944e7adeb237c6
    expect(canPayAtomically(opponentOnly, cost, ctx([0]))).toBe(false);
    expect(opponentOnly.players.opp.evidence).toEqual([{ cardId: 'OPP', faceUp: false, origin: { turn: 1, via: 'opening' } }]);
  });
});
