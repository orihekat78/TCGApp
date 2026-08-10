import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { useDecksStore } from '../../meta-app/src/state/decksStore';

type ActiveDeckState = ReturnType<typeof useDecksStore.getState> & {
  activeDeckId: string;
  setActiveDeck: (id: string) => void;
};

const getState = () => useDecksStore.getState() as ActiveDeckState;

describe('decksStore active deck', () => {
  beforeEach(() => {
    useDecksStore.setState({
      decks: [structuredClone(SAMPLE_DECK), structuredClone(SAMPLE_DECK_OPP)],
      activeDeckId: SAMPLE_DECK.id,
      _hasHydrated: true,
    } as never);
  });

  it('migrates version 3 data to the first playable deck', async () => {
    const migrate = useDecksStore.persist.getOptions().migrate;
    expect(migrate).toBeTypeOf('function');

    const migrated = await migrate!({
      decks: [structuredClone(SAMPLE_DECK_OPP), structuredClone(SAMPLE_DECK)],
    }, 3) as { activeDeckId?: string };

    expect(migrated.activeDeckId).toBe(SAMPLE_DECK_OPP.id);
  });

  it('stores only an existing playable deck as active', () => {
    getState().setActiveDeck(SAMPLE_DECK_OPP.id);
    expect(getState().activeDeckId).toBe(SAMPLE_DECK_OPP.id);

    getState().setActiveDeck('missing-deck');
    expect(getState().activeDeckId).toBe(SAMPLE_DECK_OPP.id);
  });

  it('falls back when the active deck becomes unplayable', () => {
    getState().setActiveDeck(SAMPLE_DECK_OPP.id);
    getState().update(SAMPLE_DECK_OPP.id, { cards: [] });

    expect(getState().activeDeckId).toBe(SAMPLE_DECK.id);
  });

  it('falls back when the active deck is removed', () => {
    getState().setActiveDeck(SAMPLE_DECK_OPP.id);
    getState().remove(SAMPLE_DECK_OPP.id);

    expect(getState().activeDeckId).toBe(SAMPLE_DECK.id);
  });
});
