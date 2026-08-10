import { describe, expect, it } from 'vitest';
import { CARD_POOL, cardSetCode } from '../../meta-app/src/data/cardPool';
import { EMPTY_FILTER, matchesFilter } from '../../meta-app/src/data/cardFilter';
import { normalizePersistedFilter, normalizePersistedFiltersState } from '../../meta-app/src/state/filtersStore';

describe('card product-series graph', () => {
  it('maps each printed card to one stable product series', () => {
    expect(cardSetCode('B01001')).toBe('CT-P01');
    expect(cardSetCode('B01001P')).toBe('CT-P01');
    expect(cardSetCode('D08003')).toBe('CT-D08');
    expect(cardSetCode('PR225')).toBe('PR');
  });

  it('filters print variants by their product-series edge', () => {
    const p10 = CARD_POOL.find((card) => card.num === 'B10097');
    const d08 = CARD_POOL.find((card) => card.num === 'D08003');
    expect(p10).toBeDefined();
    expect(d08).toBeDefined();

    const filter = { ...EMPTY_FILTER, sets: ['CT-P10'] };
    expect(matchesFilter(p10!, filter)).toBe(true);
    expect(matchesFilter(d08!, filter)).toBe(false);
  });

  it('normalizes malformed persisted card filters to safe defaults', () => {
    expect(normalizePersistedFilter({
      q: { query: 'bad' },
      sets: 'CT-D08',
      colors: ['purple', 8],
      types: 'character',
      features: [null, 'not-a-feature'],
      keywords: { 0: 'bad' },
      rarities: ['unknown'],
      costs: ['2'],
      featureMode: 'all',
      keywordMode: null,
    })).toEqual(EMPTY_FILTER);
  });

  it('guards malformed persisted top-level state and retains only valid filter facets and sort values', () => {
    for (const state of [null, [], 'invalid', 4, false]) {
      expect(normalizePersistedFiltersState(state)).toEqual({
        cards: EMPTY_FILTER,
        deck: EMPTY_FILTER,
        cardsSort: 'num',
        cardsSortDir: 'desc',
      });
    }

    expect(normalizePersistedFiltersState({
      cards: { q: 'Conan', sets: ['CT-D08', 'unknown'], colors: ['blue', 'purple'], costs: [2, 'bad'] },
      deck: { types: ['character', 'invalid'], featureMode: 'and', keywordMode: 'or' },
      cardsSort: 'name',
      cardsSortDir: 'asc',
    })).toMatchObject({
      cards: { q: 'Conan', sets: ['CT-D08'], colors: ['blue'], costs: [2] },
      deck: { types: ['character'], featureMode: 'and', keywordMode: 'or' },
      cardsSort: 'name',
      cardsSortDir: 'asc',
    });

    expect(normalizePersistedFiltersState({ cardsSort: 'unknown', cardsSortDir: 'sideways' }))
      .toMatchObject({ cardsSort: 'num', cardsSortDir: 'desc' });
  });
});
