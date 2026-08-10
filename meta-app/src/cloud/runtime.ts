import type { MatchRecord } from '../data/types';
import { registerDeckDeleteJournal, useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { createCloudApiClient } from './apiClient';
import {
  createCloudSyncEngine,
  type CloudSyncEngine,
  type LocalCloudDataPort,
} from './syncEngine';
import { useCloudSyncStatusStore } from './statusStore';
import type { CloudSyncStatus } from './types';

type OnlineEventTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type RuntimeOptions = {
  enabled: boolean;
  engine: CloudSyncEngine;
  eventTarget: OnlineEventTarget;
  isApplyingRemote?: () => boolean;
};

export type StoreLocalCloudDataPort = LocalCloudDataPort & {
  isApplyingRemote(): boolean;
};

function setStatus(status: CloudSyncStatus): void {
  useCloudSyncStatusStore.getState().setStatus(status);
}

function reportRuntimeFailure(): void {
  const current = useCloudSyncStatusStore.getState().status;
  setStatus({
    ...current,
    phase: 'error',
    message: 'CLOUD_SYNC_RUNTIME_FAILED',
  });
}

function matchIdentity(match: MatchRecord): string {
  return match.sessionId ?? match.id;
}

export function createStoreLocalCloudDataPort(): StoreLocalCloudDataPort {
  let applyingRemote = false;
  return {
    snapshot() {
      const decks = useDecksStore.getState();
      const history = useHistoryStore.getState();
      return structuredClone({
        decks: decks.decks,
        activeDeckId: decks.activeDeckId,
        history: history.history,
      });
    },
    mergeRemoteDecks(remoteDecks, activeDeckToAdopt) {
      applyingRemote = true;
      try {
        useDecksStore.setState((state) => {
          const remoteById = new Map(remoteDecks.map((deck) => [deck.id, deck]));
          const existing = new Set(state.decks.map((deck) => deck.id));
          const replaced = state.decks.map((deck) => {
            const remote = remoteById.get(deck.id);
            return remote ? structuredClone(remote) : deck;
          });
          const additions = remoteDecks
            .filter((deck) => !existing.has(deck.id))
            .map((deck) => structuredClone(deck));
          const hasReplacement = replaced.some((deck, index) => deck !== state.decks[index]);
          const decks = additions.length || hasReplacement
            ? [...replaced, ...additions]
            : state.decks;
          const activeDeckId = !state.activeDeckId
            && activeDeckToAdopt
            && decks.some((deck) => deck.id === activeDeckToAdopt)
            ? activeDeckToAdopt
            : state.activeDeckId;
          if (decks === state.decks && activeDeckId === state.activeDeckId) return state;
          return { decks, activeDeckId };
        });
      } finally {
        applyingRemote = false;
      }
    },
    isApplyingRemote: () => applyingRemote,
  };
}

export function startCloudSyncRuntime(options: RuntimeOptions): () => void {
  if (!options.enabled) {
    useCloudSyncStatusStore.getState().reset();
    return () => undefined;
  }

  setStatus({
    phase: 'idle',
    email: null,
    pendingCount: 0,
    lastSyncedAt: null,
    message: null,
  });

  let stopped = false;
  let queue = Promise.resolve();
  const unregisterDeckDeleteJournal = registerDeckDeleteJournal((deckId) => (
    options.engine.journalDeckDelete(deckId)
  ));
  const schedule = (operation: () => Promise<void>) => {
    queue = queue.then(async () => {
      if (!stopped) await operation();
    }).catch(() => {
      if (!stopped) reportRuntimeFailure();
    });
  };

  const unsubscribeDecks = useDecksStore.subscribe((current, previous) => {
    if (stopped || options.isApplyingRemote?.()) return;
    const previousById = new Map(previous.decks.map((deck) => [deck.id, deck]));
    const currentById = new Map(current.decks.map((deck) => [deck.id, deck]));

    for (const deck of current.decks) {
      const before = previousById.get(deck.id);
      if (!before || before.modified !== deck.modified) {
        const snapshot = structuredClone(deck);
        schedule(() => options.engine.enqueueDeck(snapshot));
      }
    }
    for (const deck of previous.decks) {
      if (!currentById.has(deck.id)) {
        schedule(() => options.engine.enqueueDeckDelete(deck.id));
      }
    }
    if (current.activeDeckId !== previous.activeDeckId) {
      schedule(() => options.engine.enqueueActiveDeck(current.activeDeckId || null));
    }
  });

  const unsubscribeHistory = useHistoryStore.subscribe((current, previous) => {
    if (stopped) return;
    const previousIds = new Set(previous.history.map(matchIdentity));
    for (const match of current.history) {
      if (!previousIds.has(matchIdentity(match))) {
        const snapshot = structuredClone(match);
        schedule(() => options.engine.enqueueMatch(snapshot));
      }
    }
  });

  const handleOnline = () => schedule(() => options.engine.drain({ forceRetry: true }));
  options.eventTarget.addEventListener('online', handleOnline);
  schedule(() => options.engine.initialize());

  return () => {
    if (stopped) return;
    stopped = true;
    unregisterDeckDeleteJournal();
    unsubscribeDecks();
    unsubscribeHistory();
    options.eventTarget.removeEventListener('online', handleOnline);
    options.engine.stop();
  };
}

function startProductionRuntime(): () => void {
  const local = createStoreLocalCloudDataPort();
  const engine = createCloudSyncEngine({
    api: createCloudApiClient(),
    local,
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
    onStatus: setStatus,
  });
  return startCloudSyncRuntime({
    enabled: import.meta.env.VITE_CLOUD_DATA_SYNC_ENABLED === 'true',
    engine,
    eventTarget: window,
    isApplyingRemote: local.isApplyingRemote,
  });
}

let productionStop: (() => void) | null = null;
let productionLeases = 0;
let pendingStop: ReturnType<typeof setTimeout> | null = null;

/** StrictMode-safe shared lease for the one browser sync runtime. */
export function acquireCloudSyncRuntime(): () => void {
  productionLeases += 1;
  if (pendingStop !== null) {
    clearTimeout(pendingStop);
    pendingStop = null;
  }
  productionStop ??= startProductionRuntime();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    productionLeases = Math.max(0, productionLeases - 1);
    if (productionLeases !== 0 || pendingStop !== null) return;
    pendingStop = setTimeout(() => {
      pendingStop = null;
      if (productionLeases !== 0) return;
      productionStop?.();
      productionStop = null;
    }, 0);
  };
}
