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
    window.localStorage.clear();
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

  it.each([
    ['undefined cards', undefined],
    ['null cards', null],
    ['a non-array cards value', 'not-an-array'],
    ['a null main entry', [null]],
  ])('repairs an active persisted deck with %s', async (_label, cards) => {
    const migrate = useDecksStore.persist.getOptions().migrate;
    expect(migrate).toBeTypeOf('function');

    const malformed = {
      ...structuredClone(SAMPLE_DECK),
      id: 'hydrated-malformed',
      cards,
    };
    const migrated = await migrate!({
      decks: [malformed, structuredClone(SAMPLE_DECK_OPP)],
      activeDeckId: malformed.id,
    }, 4) as { decks: Array<{ id: string }>; activeDeckId?: string };

    expect(migrated.decks.map(({ id }) => id)).toEqual([SAMPLE_DECK_OPP.id]);
    expect(migrated.activeDeckId).toBe(SAMPLE_DECK_OPP.id);
  });

  it('quarantines malformed current-version state during the persisted merge', () => {
    const merge = useDecksStore.persist.getOptions().merge;
    expect(merge).toBeTypeOf('function');
    const malformed = {
      ...structuredClone(SAMPLE_DECK),
      id: 'current-malformed',
      cards: null,
    };

    const merged = merge!({
      decks: [malformed, structuredClone(SAMPLE_DECK_OPP)],
      activeDeckId: malformed.id,
    }, useDecksStore.getState()) as ActiveDeckState;

    expect(merged.decks.map(({ id }) => id)).toEqual([SAMPLE_DECK_OPP.id]);
    expect(merged.activeDeckId).toBe(SAMPLE_DECK_OPP.id);
  });

  it('quarantines malformed current-version localStorage during rehydration', async () => {
    window.localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 4,
      state: {
        decks: [{
          ...structuredClone(SAMPLE_DECK),
          id: 'hydrated-malformed',
          cards: null,
        }, structuredClone(SAMPLE_DECK_OPP)],
        activeDeckId: 'hydrated-malformed',
      },
    }));

    await useDecksStore.persist.rehydrate();

    expect(getState().decks.map(({ id }) => id)).toEqual([SAMPLE_DECK_OPP.id]);
    expect(getState().activeDeckId).toBe(SAMPLE_DECK_OPP.id);
  });

  it('keeps both sample decks and the active D08 deck when persisted state is absent', () => {
    const merge = useDecksStore.persist.getOptions().merge;
    expect(merge).toBeTypeOf('function');

    const merged = merge!(undefined, getState()) as ActiveDeckState;

    expect(merged.decks.map(({ id }) => id)).toEqual([
      SAMPLE_DECK.id,
      SAMPLE_DECK_OPP.id,
    ]);
    expect(merged.activeDeckId).toBe(SAMPLE_DECK.id);
  });

  it.each([
    ['current', 4, (id: string) => ({
      ...structuredClone(SAMPLE_DECK),
      id,
    })],
    ['legacy', 1, (id: string) => ({
      ...structuredClone(SAMPLE_DECK),
      id,
      case: undefined,
    })],
  ])('quarantines every divergent duplicate ID in %s persisted data', async (
    _label,
    version,
    duplicate,
  ) => {
    const duplicateId = 'duplicate-hydrated';
    const first = { ...duplicate(duplicateId), name: 'First copy', modified: 100 };
    const second = { ...duplicate(duplicateId), name: 'Second copy', modified: 200 };
    window.localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version,
      state: {
        decks: [first, structuredClone(SAMPLE_DECK_OPP), second],
        activeDeckId: duplicateId,
      },
    }));

    await useDecksStore.persist.rehydrate();

    expect(getState().decks.map(({ id }) => id)).toEqual([SAMPLE_DECK_OPP.id]);
    expect(getState().activeDeckId).toBe(SAMPLE_DECK_OPP.id);
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
