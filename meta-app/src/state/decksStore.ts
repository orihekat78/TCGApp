// spec: .claude/specs/meta-ui/04-state-stores.md
// decksStore — カスタムデッキ管理
// persist namespace: conan.meta.v1.decks

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DeckRecord } from "../data/types";
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from "../data/sampleDeck";
import {
  defaultCaseForPartner,
  isDeckIdentityCard,
} from "../data/cardIdentities.generated";
import { isHomeDeckEligible } from "../util/deckEligibility";

interface DecksState {
  decks: DeckRecord[];
  activeDeckId: string;
  _hasHydrated: boolean;
  add: (d: Omit<DeckRecord, "modified">) => void;
  update: (id: string, patch: Partial<DeckRecord>) => void;
  remove: (id: string) => Promise<void>;
  setActiveDeck: (id: string) => void;
  byId: (id: string) => DeckRecord | undefined;
  _setHydrated: (v: boolean) => void;
}

type DeckDeleteJournal = (deckId: string) => Promise<void>;

let activeDeleteJournal: { token: symbol; journal: DeckDeleteJournal } | null = null;

export function registerDeckDeleteJournal(journal: DeckDeleteJournal): () => void {
  const token = Symbol('deck-delete-journal');
  activeDeleteJournal = { token, journal };
  return () => {
    if (activeDeleteJournal?.token === token) activeDeleteJournal = null;
  };
}

function normalizeActiveDeckId(
  decks: DeckRecord[],
  activeDeckId: string | undefined,
): string {
  const active = decks.find((deck) => deck.id === activeDeckId);
  return active && isHomeDeckEligible(active)
    ? active.id
    : (decks.find((deck) => isHomeDeckEligible(deck))?.id ?? "");
}

export const useDecksStore = create<DecksState>()(
  persist(
    (set, get) => ({
      decks: [
        { ...SAMPLE_DECK, modified: Date.now() },
        { ...SAMPLE_DECK_OPP, modified: Date.now() },
      ],
      activeDeckId: SAMPLE_DECK.id,
      _hasHydrated: false,
      add: (d) =>
        set((s) => {
          const decks = [...s.decks, { ...d, modified: Date.now() }];
          return {
            decks,
            activeDeckId: normalizeActiveDeckId(decks, s.activeDeckId),
          };
        }),
      update: (id, patch) =>
        set((s) => {
          const decks = s.decks.map((d) =>
            d.id === id ? { ...d, ...patch, modified: Date.now() } : d,
          );
          return {
            decks,
            activeDeckId: normalizeActiveDeckId(decks, s.activeDeckId),
          };
        }),
      remove: async (id) => {
        if (!get().decks.some((deck) => deck.id === id)) return;
        const journal = activeDeleteJournal?.journal;
        if (journal) await journal(id);
        set((s) => {
          const decks = s.decks.filter((d) => d.id !== id);
          return {
            decks,
            activeDeckId: normalizeActiveDeckId(decks, s.activeDeckId),
          };
        });
      },
      setActiveDeck: (id) =>
        set((s) =>
          s.decks.some((deck) => deck.id === id && isHomeDeckEligible(deck))
            ? { activeDeckId: id }
            : {},
        ),
      byId: (id) => get().decks.find((d) => d.id === id),
      _setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "conan.meta.v1.decks",
      version: 4,
      partialize: (state) => ({
        decks: state.decks,
        activeDeckId: state.activeDeckId,
      }),
      // v1 → v2: DeckRecord に事件スロット (case) を追加 (rules/02)。
      // 旧デッキはパートナーから既定の事件を補填する。さらに v1 のサンプルデッキは
      // 事件カードがデッキ内に混入していた (BUG-126) ため、正データで上書きして修復する。
      // カスタムデッキはパートナー/事件カードがデッキ内にあれば除去する (rules/02)。
      // v2 → v3: 標準デッキだけを公式構築済みレシピへ更新し、ユーザーデッキは保持する。
      migrate: (persisted, fromVersion) => {
        const s = persisted as
          | { decks?: DeckRecord[]; activeDeckId?: string }
          | undefined;
        if (fromVersion < 3 && s?.decks) {
          for (const d of s.decks) {
            if (fromVersion < 2 && !d.case)
              d.case = defaultCaseForPartner(d.partner);
            if (d.id === SAMPLE_DECK.id) {
              d.partner = SAMPLE_DECK.partner;
              d.case = SAMPLE_DECK.case;
              d.cards = structuredClone(SAMPLE_DECK.cards);
            } else if (d.id === SAMPLE_DECK_OPP.id) {
              d.partner = SAMPLE_DECK_OPP.partner;
              d.case = SAMPLE_DECK_OPP.case;
              d.cards = structuredClone(SAMPLE_DECK_OPP.cards);
            } else if (fromVersion < 2) {
              d.cards = (d.cards ?? []).filter((e) => {
                return !isDeckIdentityCard(e.num);
              });
            }
          }
        }
        if (s?.decks)
          s.activeDeckId = normalizeActiveDeckId(s.decks, s.activeDeckId);
        return s as DecksState;
      },
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    },
  ),
);
