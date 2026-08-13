import { describe, expect, it } from 'vitest';
import { SAMPLE_DECK } from '../../meta-app/src/data/sampleDeck';
import { decodeDeck, encodeDeck } from '../../meta-app/src/util/deckCode';

describe('deck-code import', () => {
  it('keeps a legal deck importable', () => {
    expect(decodeDeck(encodeDeck(SAMPLE_DECK))).toMatchObject({
      partner: SAMPLE_DECK.partner,
      case: SAMPLE_DECK.case,
      cards: SAMPLE_DECK.cards,
    });
  });

  it.each([
    ['a partner in main', [{ num: 'D08002', count: 40 }]],
    ['a partner in main', [{ num: 'D08002', count: 40 }]],
    ['combined reprints over their official-ID copy limit', [
      { num: 'D08005', count: 3 },
      { num: 'D08006', count: 37 },
    ]],
  ])('does not decode %s into an importable draft', (_label, cards) => {
    const code = encodeDeck({ ...SAMPLE_DECK, cards });

    expect(decodeDeck(code)).toBeNull();
  });

  it.each([
    ['an unknown printing', { ...SAMPLE_DECK, partner: 'unknown' }],
    ['wrong partner and case slots', { ...SAMPLE_DECK, partner: 'D08003', case: 'D08001' }],
  ])('does not decode %s into an importable draft', (_label, deck) => {
    expect(decodeDeck(encodeDeck(deck))).toBeNull();
  });

  it('keeps duplicate printing IDs structurally invalid before legality checks', () => {
    expect(decodeDeck(encodeDeck({
      ...SAMPLE_DECK,
      cards: [{ num: 'B09100', count: 20 }, { num: 'B09100', count: 20 }],
    }))).toBeNull();
  });
});
