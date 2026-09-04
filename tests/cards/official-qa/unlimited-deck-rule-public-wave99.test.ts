// qa: card:B09100:d0e693e845a989227a1f748f447006aac04210c1d6e72bf100fe32eeff0b9b05
// qa: card:PR158:d0e693e845a989227a1f748f447006aac04210c1d6e72bf100fe32eeff0b9b05
// qa: card:PR164:d0e693e845a989227a1f748f447006aac04210c1d6e72bf100fe32eeff0b9b05
// qa: card:B09100:efd6c21e2f7905796100f2d468a68b999155b3da10e77373da20e6be92c33536
// qa: card:PR158:efd6c21e2f7905796100f2d468a68b999155b3da10e77373da20e6be92c33536
// qa: card:PR164:efd6c21e2f7905796100f2d468a68b999155b3da10e77373da20e6be92c33536

import { beforeEach, describe, expect, it } from 'vitest';
import { B09100 } from '@/cards/ct-p09/B09100';
import { PR158 } from '@/cards/pr-01/PR158';
import { PR164 } from '@/cards/pr-01/PR164';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { deckLegalityCatalogResolver } from '@/shared/deck-legality-catalog.generated';
import { validateDeckLegality } from '@/shared/deck-legality';
import { engineStub } from '../../../meta-app/src/stubs/engineStub';
import { makeChar } from '../../helpers/fixtures';

const CARDS = [B09100, PR158, PR164] as const;
const base = {
  partner: 'D08001',
  case: 'D08026',
};

function sharedDeck(card: CardDef, count: number) {
  return {
    ...base,
    main: [{ printingId: card.id, count }],
  };
}

function publicDeck(card: CardDef, count: number) {
  return {
    id: `wave99-${card.id}-${count}`,
    name: `Wave99 ${card.id}`,
    partner: base.partner,
    case: base.case,
    cards: [{ num: card.id, count }],
    modified: 0,
  };
}

beforeEach(() => {
  _resetRegistry();
  for (const card of CARDS) register(card);
});

describe('official QA Wave99: B09100 PR158 PR164 unlimited copy rules', () => {
  it.each(CARDS)('$id remains a static deck rule when its original runtime abilities are disabled', card => { // Card-bound: B09100 PR158 PR164.
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({ cardId: card.id, uid: 'subject' })];
    mutate.char.disableOriginalAbilities(state, 'subject', 'permanent');

    expect(readChar.originalAbilitiesDisabled(state, 'subject')).toBe(true);
    expect(card.deckLimit).toBe('unlimited');
    expect(engineStub.cards.validateDeck(publicDeck(card, 40)))
      .toEqual({ ok: true, errors: [], warnings: [] });
  });

  it.each(CARDS)('$id permits any copy count only inside the fixed 40-card main deck', card => { // Card-bound: B09100 PR158 PR164.
    expect(validateDeckLegality(sharedDeck(card, 40), deckLegalityCatalogResolver))
      .toEqual({ ok: true, errors: [], warnings: [] });

    const overForty = validateDeckLegality(sharedDeck(card, 41), deckLegalityCatalogResolver);
    expect(overForty.ok).toBe(false);
    expect(overForty.errors).toContain('MAIN_COUNT');
    expect(overForty.errors).not.toContain('COPY_LIMIT');
    expect(engineStub.cards.validateDeck(publicDeck(card, 41)).ok).toBe(false);
  });
});
