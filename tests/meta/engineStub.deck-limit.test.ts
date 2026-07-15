// rules: 02-deck-construction.md

import { describe, expect, it } from 'vitest';
import { engineStub } from '../../meta-app/src/stubs/engineStub';

const deckBase = {
  id: 'deck-limit-test',
  name: 'deck limit test',
  partner: 'D08001',
  case: 'D08026',
  modified: 0,
};

describe('meta engineStub deck-limit validation', () => {
  it('accepts 40 copies of B09100, the shipped unlimited-deck exemplar', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'B09100', count: 40 }],
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('accepts 40 combined PR158/PR164 printings of unlimited ID 0627', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [
        { num: 'PR158', count: 20 },
        { num: 'PR164', count: 20 },
      ],
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('continues rejecting more than three copies of an ordinary card', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'D08005', count: 40 }],
    });

    expect(result.ok).toBe(false);
  });
});
