// rules: 02-deck-construction.md

import { describe, expect, it } from 'vitest';
import { BUG_274_PUBLIC_DECK, BUG_274_PUBLIC_DECK_ID } from '../../meta-app/src/data/bug274ValidationDeck';
import { engineStub } from '../../meta-app/src/stubs/engineStub';
import { isPlayable } from '../../meta-app/src/util/deckBridge';

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

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('accepts 40 combined PR158/PR164 printings of unlimited ID 0627', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [
        { num: 'PR158', count: 20 },
        { num: 'PR164', count: 20 },
      ],
    });

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('continues rejecting more than three copies of an ordinary card', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'D08005', count: 40 }],
    });

    expect(result.ok).toBe(false);
  });

  it('fails closed for an unsafe deck entry count', () => {
    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'D08005', count: 39.5 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).not.toEqual([]);
  });

  it('keeps a competitive-restriction notice nonblocking in casual play', () => {
    const prohibited = engineStub.cards.all().find((card) => card.id === '0208');
    if (!prohibited) throw new Error('official printing 0208 missing from card pool');
    const filler = engineStub.cards.all().find((card) => card.type === 'character' && card.deckLimit === 'unlimited');
    if (!filler) throw new Error('unlimited character filler missing from card pool');

    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: prohibited.num, count: 1 }, { num: filler.num, count: 39 }],
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('0208'))).toBe(true);
  });

  it('uses the BUG-274 synthetic partner overlay without bypassing other legality checks', () => {
    expect(isPlayable(BUG_274_PUBLIC_DECK)).toBe(true);
    expect(isPlayable({
      ...BUG_274_PUBLIC_DECK,
      id: BUG_274_PUBLIC_DECK_ID,
      cards: [{ num: 'D08005', count: 39 }],
    })).toBe(false);
  });

  it('fails closed when a partner overlay returns a different printing number', () => {
    const partner = engineStub.cards.byNum(deckBase.partner);
    if (!partner) throw new Error('fixture partner missing from card pool');

    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'B09100', count: 40 }],
    }, (printingId) => printingId === deckBase.partner ? { ...partner, num: 'spoofed-partner' } : undefined);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('パートナーカードが見つかりません');
  });

  it('fails closed when a main-card overlay returns a different printing number', () => {
    const mainCard = engineStub.cards.byNum('B09100');
    if (!mainCard) throw new Error('fixture main card missing from card pool');

    const result = engineStub.cards.validateDeck({
      ...deckBase,
      cards: [{ num: 'B09100', count: 40 }],
    }, (printingId) => printingId === 'B09100' ? { ...mainCard, num: 'spoofed-main' } : undefined);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('未登録のカードが含まれています');
  });
});
