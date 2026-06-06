// spec: .claude/specs/meta-ui/ (Phase 18: フィルタ sticky 化)
// CardsScreen / DeckEditor のフィルタ・ソートを永続化して、画面遷移・セッションを跨いで保持する
// (Master Duel 研究: フィルタが遷移でリセットされる不満を回避)。
// persist namespace: conan.meta.v1.filters

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_FILTER, type CardFilterState, type SortDir, type SortKey } from '../data/cardFilter';

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
    { name: 'conan.meta.v1.filters', version: 1 }
  )
);
