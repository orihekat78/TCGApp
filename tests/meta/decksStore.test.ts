import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import {
  registerDeckDeleteJournal,
  useDecksStore,
} from '../../meta-app/src/state/decksStore';

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

  it('uses the lightweight identity index to complete and clean legacy decks', async () => {
    const migrate = useDecksStore.persist.getOptions().migrate;
    expect(migrate).toBeTypeOf('function');

    const migrated = await migrate!({
      decks: [{
        ...structuredClone(SAMPLE_DECK_OPP),
        id: 'legacy-d11',
        case: undefined,
        cards: [
          { num: 'D11003', count: 1 },
          { num: 'D11001', count: 1 },
          { num: 'D11021', count: 1 },
        ],
      }],
    }, 1) as { decks: Array<{ case?: string; cards: { num: string }[] }> };

    expect(migrated.decks[0]?.case).toBe('D11021');
    expect(migrated.decks[0]?.cards).toEqual([{ num: 'D11003', count: 1 }]);
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

  it('commits a removal only after its durable journal finishes', async () => {
    let finishJournal!: () => void;
    const journal = vi.fn(() => new Promise<void>((resolve) => { finishJournal = resolve; }));
    const unregister = registerDeckDeleteJournal(journal);

    try {
      const removal = getState().remove(SAMPLE_DECK_OPP.id);
      expect(getState().byId(SAMPLE_DECK_OPP.id)).toBeDefined();
      expect(journal).toHaveBeenCalledWith(SAMPLE_DECK_OPP.id);

      finishJournal();
      await removal;

      expect(getState().byId(SAMPLE_DECK_OPP.id)).toBeUndefined();
    } finally {
      unregister();
    }
  });
});
