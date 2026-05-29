// spec: .claude/specs/meta-ui/04-state-stores.md
// historyStore — 模擬対戦履歴 (engineStub.flow.simulateMatch 結果のみ)
// persist namespace: conan.meta.v1.history
// p1Target/p2Target は公式準拠 7/6 (F-rule-audit 高優先度修正)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MatchRecord } from '../data/types';

const MAX_RECORDS = 500;

interface WinRateInfo {
  rate: number;
  wins: number;
  total: number;
}

interface HistoryState {
  history: MatchRecord[];
  _hasHydrated: boolean;
  record: (m: MatchRecord) => void;
  list: () => MatchRecord[];
  byId: (id: string) => MatchRecord | undefined;
  winRate: (deckName?: string) => WinRateInfo;
  clear: () => void;
  _setHydrated: (v: boolean) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      _hasHydrated: false,
      record: (m) =>
        set((s) => {
          const next = [m, ...s.history];
          if (next.length > MAX_RECORDS) next.length = MAX_RECORDS;
          return { history: next };
        }),
      list: () => get().history,
      byId: (id) => get().history.find((m) => m.id === id),
      winRate: (deckName) => {
        const items = get().history.filter(
          (m) => !deckName || m.deckName === deckName
        );
        if (items.length === 0) return { rate: 0, wins: 0, total: 0 };
        const wins = items.filter((m) => m.won).length;
        return {
          rate: Math.round((wins / items.length) * 100),
          wins,
          total: items.length,
        };
      },
      clear: () => set({ history: [] }),
      _setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'conan.meta.v1.history',
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);
