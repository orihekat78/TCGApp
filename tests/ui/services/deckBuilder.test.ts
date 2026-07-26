// Task 8.4b: deckBuilder unit tests

import { describe, it, expect } from 'vitest';
import { buildMvpDeckPair } from '@/ui/services/deckBuilder';
import { ALL_CARDS } from '@/cards/index';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../../meta-app/src/data/sampleDeck';

const officialIdByPrinting = new Map(
  ALL_CARDS.map((card) => [card.id, card.no.split('/')[0]!] as const),
);

describe('buildMvpDeckPair', () => {
  it('self deck = CT-D08 (partner D08001, case D08026)', () => {
    const pair = buildMvpDeckPair();
    expect(pair.self.partnerId).toBe('D08001');
    expect(pair.self.caseId).toBe('D08026');
  });

  it('opp deck = CT-D11 (partner D11001, case D11021)', () => {
    const pair = buildMvpDeckPair();
    expect(pair.opp.partnerId).toBe('D11001');
    expect(pair.opp.caseId).toBe('D11021');
  });

  it('main 40 枚 (rules/02 デッキサイズ)', () => {
    const pair = buildMvpDeckPair();
    expect(pair.self.mainCards.length).toBe(40);
    expect(pair.opp.mainCards.length).toBe(40);
  });

  it('同一 ID は最大 3 枚 (rules/02 制約)', () => {
    const pair = buildMvpDeckPair();
    for (const deck of [pair.self.mainCards, pair.opp.mainCards]) {
      const counts: Record<string, number> = {};
      for (const printing of deck) {
        const officialId = officialIdByPrinting.get(printing);
        expect(officialId, `未登録印刷: ${printing}`).toBeDefined();
        counts[officialId!] = (counts[officialId!] ?? 0) + 1;
      }
      for (const [, n] of Object.entries(counts)) {
        expect(n).toBeLessThanOrEqual(3);
      }
    }
  });

  it('Meta UI の標準デッキも Engine の CT-D08 / CT-D11 と一致する', () => {
    const pair = buildMvpDeckPair();
    const expand = (cards: Array<{ num: string; count: number }>) =>
      cards.flatMap(({ num, count }) => Array.from({ length: count }, () => num)).sort();

    expect(SAMPLE_DECK.cards).toEqual([
      { num: 'D08003', count: 1 }, { num: 'D08004', count: 2 },
      { num: 'D08005', count: 1 }, { num: 'D08006', count: 2 },
      { num: 'D08007', count: 1 }, { num: 'D08008', count: 2 },
      { num: 'D08009', count: 1 }, { num: 'D08010', count: 2 },
      { num: 'D08011', count: 1 }, { num: 'D08012', count: 2 },
      { num: 'D08013', count: 1 }, { num: 'D08014', count: 2 },
      { num: 'D08015', count: 1 }, { num: 'D08016', count: 2 },
      { num: 'D08017', count: 1 }, { num: 'D08018', count: 2 },
      { num: 'D08019', count: 1 }, { num: 'D08020', count: 2 },
      { num: 'D08021', count: 2 }, { num: 'D08022', count: 3 },
      { num: 'D08023', count: 2 }, { num: 'D08024', count: 3 },
      { num: 'D08025', count: 3 },
    ]);
    expect(SAMPLE_DECK_OPP.cards).toEqual([
      { num: 'D11003', count: 1 }, { num: 'D11004', count: 2 },
      { num: 'D11005', count: 1 }, { num: 'D11006', count: 2 },
      { num: 'D11007', count: 1 }, { num: 'D11008', count: 2 },
      { num: 'D11009', count: 1 }, { num: 'D11010', count: 2 },
      { num: 'D11011', count: 3 }, { num: 'D11012', count: 3 },
      { num: 'D11013', count: 3 }, { num: 'D11014', count: 3 },
      { num: 'D11015', count: 3 }, { num: 'D11016', count: 3 },
      { num: 'D11017', count: 3 }, { num: 'D11018', count: 3 },
      { num: 'D11019', count: 2 }, { num: 'D11020', count: 2 },
    ]);

    expect(expand(SAMPLE_DECK.cards)).toEqual([...pair.self.mainCards].sort());
    expect(expand(SAMPLE_DECK_OPP.cards)).toEqual([...pair.opp.mainCards].sort());
  });
});
