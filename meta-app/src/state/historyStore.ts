// spec: .claude/specs/meta-ui/04-state-stores.md
// historyStore — 模擬対戦履歴 (engineStub.flow.simulateMatch 結果のみ)
// persist namespace: conan.meta.v1.history
// p1Target/p2Target は公式準拠 7/6 (F-rule-audit 高優先度修正)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryReplayRefV1, MatchRecord } from '../data/types';
import { normalizeMatchDeckSnapshot } from '../data/matchDeckSnapshot';

const MAX_RECORDS = 500;

interface WinRateInfo {
  rate: number;
  wins: number;
  total: number;
}

interface HistoryState {
  history: MatchRecord[];
  _hasHydrated: boolean;
  _hasCanonicalLoaded: boolean;
  record: (m: MatchRecord) => void;
  list: () => MatchRecord[];
  byId: (id: string) => MatchRecord | undefined;
  winRate: (deckName?: string) => WinRateInfo;
  clear: () => void;
  mergeCanonical: (records: MatchRecord[]) => void;
  _setHydrated: (v: boolean) => void;
  _setCanonicalLoaded: (v: boolean) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function targetOr(value: unknown): 7 | 6 {
  return value === 7 || value === 6 ? value : 7;
}

function normalizeReplayRef(value: unknown): HistoryReplayRefV1 | undefined {
  if (!isRecord(value)) return undefined;
  const artifactId = validId(value.artifactId);
  const digest = typeof value.digest === 'string' && /^sha256-[0-9a-f]{64}$/.test(value.digest)
    ? value.digest as HistoryReplayRefV1['digest']
    : undefined;
  if (
    value.storageSchemaVersion !== 1
    || value.replaySchemaVersion !== 3
    || !artifactId
    || !digest
    || !Number.isSafeInteger(value.byteLength)
    || Number(value.byteLength) < 1
  ) return undefined;
  return {
    storageSchemaVersion: 1,
    replaySchemaVersion: 3,
    artifactId,
    digest,
    byteLength: Number(value.byteLength),
  };
}

export function normalizeHistoryRow(value: unknown): MatchRecord | undefined {
  if (!isRecord(value)) return undefined;
  const id = validId(value.id);
  if (!id) return undefined;

  const sessionId = validId(value.sessionId);
  const selfDeckSnapshot = normalizeMatchDeckSnapshot(value.selfDeckSnapshot);
  const oppDeckSnapshot = normalizeMatchDeckSnapshot(value.oppDeckSnapshot);
  const replayRef = normalizeReplayRef(value.replayRef);
  return {
    id,
    ...(sessionId ? { sessionId } : {}),
    recorded: numberOr(value.recorded, Number.NaN),
    won: typeof value.won === 'boolean' ? value.won : false,
    deckName: typeof value.deckName === 'string' ? value.deckName : '不明のデッキ',
    ...(typeof value.oppDeckName === 'string' ? { oppDeckName: value.oppDeckName } : {}),
    ...(selfDeckSnapshot ? { selfDeckSnapshot } : {}),
    ...(oppDeckSnapshot ? { oppDeckSnapshot } : {}),
    ...(replayRef ? { replayRef } : {}),
    ...(value.mode === 'solo' || value.mode === 'observe' ? { mode: value.mode } : {}),
    turns: numberOr(value.turns, 0),
    duration: numberOr(value.duration, 0),
    ...(typeof value.mvp === 'string' ? { mvp: value.mvp } : {}),
    evidGot: numberOr(value.evidGot, 0),
    evidLost: numberOr(value.evidLost, 0),
    contacts: numberOr(value.contacts, 0),
    hirameki: numberOr(value.hirameki, 0),
    misread: numberOr(value.misread, 0),
    p1Target: targetOr(value.p1Target),
    p2Target: targetOr(value.p2Target),
  };
}

/** Accept old valid rows while ensuring persisted data cannot reach consumers unchecked. */
export function normalizePersistedHistoryState(value: unknown): Pick<HistoryState, 'history'> {
  const persisted = isRecord(value) ? value : {};
  const history = Array.isArray(persisted.history)
    ? persisted.history.map(normalizePersistedHistoryRow).filter((record): record is MatchRecord => record !== undefined)
    : [];
  return { history: history.slice(0, MAX_RECORDS) };
}

function withoutReplayRef(record: MatchRecord): MatchRecord {
  const { replayRef: _replayRef, ...persistable } = record;
  return persistable;
}

function normalizePersistedHistoryRow(value: unknown): MatchRecord | undefined {
  const normalized = normalizeHistoryRow(value);
  return normalized ? withoutReplayRef(normalized) : undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      _hasHydrated: false,
      _hasCanonicalLoaded: false,
      record: (m) =>
        set((s) => {
          const normalized = normalizeHistoryRow(m);
          if (!normalized) return s;
          const identity = normalized.sessionId ?? normalized.id;
          if (s.history.some((record) => (record.sessionId ?? record.id) === identity)) return s;
          const next = [normalized, ...s.history];
          if (next.length > MAX_RECORDS) next.length = MAX_RECORDS;
          return { history: next };
        }),
      list: () => get().history,
      byId: (id) => get().history.find((m) => m.id === id),
      winRate: (deckName) => {
        const items = get().history.filter(
          (m) => m.mode !== 'observe' && (!deckName || m.deckName === deckName)
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
      mergeCanonical: (records) => set((state) => {
        const merged = [...records, ...state.history]
          .map(normalizeHistoryRow)
          .filter((record): record is MatchRecord => record !== undefined);
        const seen = new Set<string>();
        const history = merged.filter((record) => {
          const identity = record.sessionId ?? record.id;
          if (seen.has(identity)) return false;
          seen.add(identity);
          return true;
        }).sort((a, b) => b.recorded - a.recorded).slice(0, MAX_RECORDS);
        return { history };
      }),
      _setHydrated: (v) => set({ _hasHydrated: v }),
      _setCanonicalLoaded: (v) => set({ _hasCanonicalLoaded: v }),
    }),
    {
      name: 'conan.meta.v1.history',
      version: 4,
      partialize: (state) => ({
        history: state.history.map(withoutReplayRef),
      }),
      migrate: (persisted) => normalizePersistedHistoryState(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...normalizePersistedHistoryState(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);
