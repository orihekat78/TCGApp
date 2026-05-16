// Task 8.4b: deckBuilder unit tests

import { describe, it, expect } from 'vitest';
import { buildMvpDeckPair } from '@/ui/services/deckBuilder';

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
      for (const id of deck) counts[id] = (counts[id] ?? 0) + 1;
      for (const [, n] of Object.entries(counts)) {
        expect(n).toBeLessThanOrEqual(3);
      }
    }
  });
});
