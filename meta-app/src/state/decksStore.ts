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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePersistedDeck(value: unknown): DeckRecord | null {
  if (!isRecord(value) || !Array.isArray(value.cards)) return null;
  if (
    typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.partner !== "string"
    || typeof value.case !== "string"
    || !Number.isSafeInteger(value.modified)
  ) return null;
  const cards: DeckRecord["cards"] = [];
  for (const entry of value.cards) {
    if (
      !isRecord(entry)
      || typeof entry.num !== "string"
      || !Number.isSafeInteger(entry.count)
    ) return null;
    cards.push({ num: entry.num, count: entry.count as number });
  }
  return {
    id: value.id,
    name: value.name,
    partner: value.partner,
    case: value.case,
    cards,
    modified: value.modified as number,
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

function normalizePersistedDecksState(value: unknown): {
  decks: DeckRecord[];
  activeDeckId: string;
} {
  const persisted = isRecord(value) ? value : {};
  const rawDecks = Array.isArray(persisted.decks) ? persisted.decks : [];
  const idCounts = new Map<string, number>();
  for (const rawDeck of rawDecks) {
    if (!isRecord(rawDeck) || typeof rawDeck.id !== "string") continue;
    idCounts.set(rawDeck.id, (idCounts.get(rawDeck.id) ?? 0) + 1);
  }
  // A duplicate ID has no trustworthy winner. Quarantine every member instead
  // of letting input order choose which divergent deck reaches cloud sync.
  const decks = rawDecks
    .map(normalizePersistedDeck)
    .filter((deck): deck is DeckRecord => (
      deck !== null && idCounts.get(deck.id) === 1
    ));
  return {
    decks,
    activeDeckId: normalizeActiveDeckId(
      decks,
      typeof persisted.activeDeckId === "string" ? persisted.activeDeckId : undefined,
    ),
  };
}

function migrateLegacyPersistedState(value: unknown, fromVersion: number): unknown {
  if (fromVersion >= 3 || !isRecord(value) || !Array.isArray(value.decks)) return value;
  const migrated = { ...value };
  migrated.decks = value.decks.map((rawDeck) => {
    if (!isRecord(rawDeck)) return rawDeck;
    const deck = { ...rawDeck };
    if (fromVersion < 2 && !deck.case && typeof deck.partner === "string") {
      deck.case = defaultCaseForPartner(deck.partner);
    }
    if (deck.id === SAMPLE_DECK.id) {
      deck.partner = SAMPLE_DECK.partner;
      deck.case = SAMPLE_DECK.case;
      deck.cards = structuredClone(SAMPLE_DECK.cards);
    } else if (deck.id === SAMPLE_DECK_OPP.id) {
      deck.partner = SAMPLE_DECK_OPP.partner;
      deck.case = SAMPLE_DECK_OPP.case;
      deck.cards = structuredClone(SAMPLE_DECK_OPP.cards);
    } else if (fromVersion < 2 && Array.isArray(deck.cards)) {
      deck.cards = deck.cards.filter((entry) => (
        !isRecord(entry)
        || typeof entry.num !== "string"
        || !isDeckIdentityCard(entry.num)
      ));
    }
    return deck;
  });
  return migrated;
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
        return normalizePersistedDecksState(
          migrateLegacyPersistedState(persisted, fromVersion),
        ) as DecksState;
      },
      merge: (persisted, current) => persisted === undefined
        ? current
        : {
          ...current,
          ...normalizePersistedDecksState(persisted),
        },
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    },
  ),
);
