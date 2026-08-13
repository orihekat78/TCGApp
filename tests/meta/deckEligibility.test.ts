import { describe, expect, it } from 'vitest';
import { BUG_274_PUBLIC_DECK } from '../../meta-app/src/data/bug274ValidationDeck';
import { SAMPLE_DECK } from '../../meta-app/src/data/sampleDeck';
import { isHomeDeckEligible } from '../../meta-app/src/util/deckEligibility';
import type { DeckRecord } from '../../meta-app/src/data/types';

describe('home deck eligibility', () => {
  it('uses the shared catalog for legal and illegal deck choices', () => {
    expect(isHomeDeckEligible(SAMPLE_DECK)).toBe(true);
    expect(isHomeDeckEligible({
      ...SAMPLE_DECK,
      cards: [{ num: 'D08002', count: 40 }],
    })).toBe(false);
    expect(isHomeDeckEligible({ ...SAMPLE_DECK, partner: 'unknown' })).toBe(false);
  });

  it('admits only the route-owned BUG-274 synthetic partner deck overlay', () => {
    expect(isHomeDeckEligible(BUG_274_PUBLIC_DECK)).toBe(true);
    expect(isHomeDeckEligible({ ...BUG_274_PUBLIC_DECK })).toBe(false);
    expect(isHomeDeckEligible({
      ...BUG_274_PUBLIC_DECK,
      cards: [{ num: 'D08005', count: 39 }],
    })).toBe(false);
  });

  it.each([
    ['undefined cards', undefined],
    ['null cards', null],
    ['a non-array cards value', 'not-an-array'],
    ['a null main entry', [null]],
    ['a malformed main entry', [{ count: 40 }]],
  ])('fails closed for hydrated decks with %s', (_label, cards) => {
    const hydrated = { ...SAMPLE_DECK, cards } as unknown as DeckRecord;

    expect(() => isHomeDeckEligible(hydrated)).not.toThrow();
    expect(isHomeDeckEligible(hydrated)).toBe(false);
  });
});
