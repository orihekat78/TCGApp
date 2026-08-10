// spec: .claude/specs/meta-ui/ (Phase 18: フィルタ sticky 化)
// CardsScreen / DeckEditor のフィルタ・ソートを永続化して、画面遷移・セッションを跨いで保持する
// (Master Duel 研究: フィルタが遷移でリセットされる不満を回避)。
// persist namespace: conan.meta.v1.filters

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ALL_CARD_SETS,
  ALL_FEATURES,
  ALL_KEYWORDS,
  ALL_RARITIES,
  COLOR_META,
  COST_BUCKETS,
  EMPTY_FILTER,
  TYPE_META,
  type CardFilterState,
  type SortDir,
  type SortKey,
} from '../data/cardFilter';

interface FiltersState {
  cards: CardFilterState;     // CardsScreen のコレクション絞り込み
  deck: CardFilterState;      // DeckEditor のプール絞り込み
  cardsSort: SortKey;
  cardsSortDir: SortDir;
  setCards: (patch: Partial<CardFilterState>) => void;
  setDeck: (patch: Partial<CardFilterState>) => void;
  resetCards: () => void;
  resetDeck: () => void;
  setCardsSort: (key: SortKey, dir?: SortDir) => void;
}

function normalizeArray<T extends string | number>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const allowedValues = new Set<T>(allowed);
  return [...new Set(value.filter((item): item is T => allowedValues.has(item as T)))];
}

function normalizeMatchMode(value: unknown): CardFilterState['featureMode'] {
  return value === 'and' || value === 'or' ? value : 'or';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSortKey(value: unknown): SortKey {
  return value === 'num' || value === 'cost' || value === 'ap' || value === 'lp' || value === 'name'
    ? value
    : 'num';
}

function normalizeSortDir(value: unknown): SortDir {
  return value === 'asc' || value === 'desc' ? value : 'desc';
}

export function normalizePersistedFilter(value: unknown): CardFilterState {
  const filter = isRecord(value) ? value as Partial<CardFilterState> : undefined;
  return {
    ...EMPTY_FILTER,
    q: typeof filter?.q === 'string' ? filter.q : '',
    sets: normalizeArray(filter?.sets, ALL_CARD_SETS),
    colors: normalizeArray(filter?.colors, COLOR_META.map(({ c }) => c)),
    types: normalizeArray(filter?.types, TYPE_META.map(({ t }) => t)),
    features: normalizeArray(filter?.features, ALL_FEATURES),
    keywords: normalizeArray(filter?.keywords, ALL_KEYWORDS),
    rarities: normalizeArray(filter?.rarities, ALL_RARITIES),
    costs: normalizeArray(filter?.costs, COST_BUCKETS),
    featureMode: normalizeMatchMode(filter?.featureMode),
    keywordMode: normalizeMatchMode(filter?.keywordMode),
  };
}

export function normalizePersistedFiltersState(value: unknown): Pick<FiltersState, 'cards' | 'deck' | 'cardsSort' | 'cardsSortDir'> {
  const state = isRecord(value) ? value : {};
  return {
    cards: normalizePersistedFilter(state.cards),
    deck: normalizePersistedFilter(state.deck),
    cardsSort: normalizeSortKey(state.cardsSort),
    cardsSortDir: normalizeSortDir(state.cardsSortDir),
  };
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      cards: { ...EMPTY_FILTER },
      deck: { ...EMPTY_FILTER },
      cardsSort: 'num',
      cardsSortDir: 'desc',
      setCards: (patch) => set((s) => ({ cards: { ...s.cards, ...patch } })),
      setDeck: (patch) => set((s) => ({ deck: { ...s.deck, ...patch } })),
      resetCards: () => set({ cards: { ...EMPTY_FILTER } }),
      resetDeck: () => set({ deck: { ...EMPTY_FILTER } }),
      setCardsSort: (key, dir) => set((s) => ({ cardsSort: key, cardsSortDir: dir ?? s.cardsSortDir })),
    }),
    {
      name: 'conan.meta.v1.filters',
      version: 2,
      migrate: (persisted) => {
        return normalizePersistedFiltersState(persisted) as FiltersState;
      },
      merge: (persisted, current) => {
        return {
          ...current,
          ...normalizePersistedFiltersState(persisted),
        };
      },
    }
  )
);
