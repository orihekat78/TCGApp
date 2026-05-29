// spec: .claude/specs/meta-ui/04-state-stores.md
// decksStore — カスタムデッキ管理
// persist namespace: conan.meta.v1.decks

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeckRecord } from '../data/types';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../data/sampleDeck';

interface DecksState {
  decks: DeckRecord[];
  _hasHydrated: boolean;
  add: (d: Omit<DeckRecord, 'modified'>) => void;
  update: (id: string, patch: Partial<DeckRecord>) => void;
  remove: (id: string) => void;
  byId: (id: string) => DeckRecord | undefined;
  _setHydrated: (v: boolean) => void;
}

export const useDecksStore = create<DecksState>()(
  persist(
    (set, get) => ({
      decks: [
        { ...SAMPLE_DECK, modified: Date.now() },
        { ...SAMPLE_DECK_OPP, modified: Date.now() },
      ],
      _hasHydrated: false,
      add: (d) =>
        set((s) => ({
          decks: [...s.decks, { ...d, modified: Date.now() }],
        })),
      update: (id, patch) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === id ? { ...d, ...patch, modified: Date.now() } : d
          ),
        })),
      remove: (id) =>
        set((s) => ({ decks: s.decks.filter((d) => d.id !== id) })),
      byId: (id) => get().decks.find((d) => d.id === id),
      _setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'conan.meta.v1.decks',
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);
