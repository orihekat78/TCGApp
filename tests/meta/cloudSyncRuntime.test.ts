import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStoreLocalCloudDataPort,
  startCloudSyncRuntime,
} from '../../meta-app/src/cloud/runtime';
import {
  CloudSyncOwnerMismatchError,
  bindCloudSyncOwner,
  readCloudSyncState,
  updateCloudSyncState,
} from '../../meta-app/src/cloud/storage';
import { useCloudSyncStatusStore } from '../../meta-app/src/cloud/statusStore';
import {
  createCloudSyncEngine,
  type CloudSyncEngine,
} from '../../meta-app/src/cloud/syncEngine';
import type { CloudBootstrap, CloudSyncOperation } from '../../meta-app/src/cloud/types';
import type { DeckRecord, MatchRecord } from '../../meta-app/src/data/types';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { useHistoryStore } from '../../meta-app/src/state/historyStore';

const NOW = 2_000_000;

function deck(id = 'deck-1'): DeckRecord {
  return {
    id,
    name: `Deck ${id}`,
    partner: 'D08001',
    case: 'D08026',
    cards: [{ num: 'D08002', count: 40 }],
    modified: NOW,
  };
}

function match(id = 'match-1'): MatchRecord {
  return {
    id,
    sessionId: id,
    recorded: NOW,
    won: true,
    deckName: 'Deck deck-1',
    mode: 'solo',
    selfDeckSnapshot: {
      schemaVersion: 1,
      deckId: 'deck-1',
      name: 'Deck deck-1',
      partner: 'D08001',
      case: 'D08026',
      cards: [{ num: 'D08002', count: 40 }],
    },
    turns: 6,
    duration: 0,
    evidGot: 7,
    evidLost: 2,
    contacts: 0,
    hirameki: 0,
    misread: 0,
    p1Target: 7,
    p2Target: 6,
  };
}

function engine(overrides: Partial<CloudSyncEngine> = {}): CloudSyncEngine {
  return {
    initialize: vi.fn(async () => undefined),
    stop: vi.fn(),
    drain: vi.fn(async () => undefined),
    journalDeckDelete: vi.fn(async () => undefined),
    enqueueDeck: vi.fn(async () => undefined),
    enqueueDeckDelete: vi.fn(async () => undefined),
    enqueueActiveDeck: vi.fn(async () => undefined),
    enqueueMatch: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('cloud sync runtime', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    useDecksStore.setState({
      decks: [deck()],
      activeDeckId: 'deck-1',
      _hasHydrated: true,
    });
    useHistoryStore.setState({
      history: [],
      _hasHydrated: true,
      _hasCanonicalLoaded: true,
    });
    useCloudSyncStatusStore.getState().reset();
  });

  it('does not initialize or subscribe while the feature flag is disabled', async () => {
    const mockEngine = engine();
    const stop = startCloudSyncRuntime({
      enabled: false,
      engine: mockEngine,
      eventTarget: window,
    });

    useDecksStore.getState().update('deck-1', { name: 'Local only' });
    await settle();

    expect(mockEngine.initialize).not.toHaveBeenCalled();
    expect(mockEngine.enqueueDeck).not.toHaveBeenCalled();
    expect(useCloudSyncStatusStore.getState().status.phase).toBe('disabled');
    stop();
  });

  it('queues deck changes before active-deck changes and sends new match rows', async () => {
    const calls: string[] = [];
    const mockEngine = engine({
      initialize: vi.fn(async () => { calls.push('initialize'); }),
      enqueueDeck: vi.fn(async () => { calls.push('deck'); }),
      enqueueActiveDeck: vi.fn(async () => { calls.push('active'); }),
      enqueueMatch: vi.fn(async () => { calls.push('match'); }),
    });
    const stop = startCloudSyncRuntime({ enabled: true, engine: mockEngine, eventTarget: window });
    await settle();

    useDecksStore.setState((state) => ({
      decks: [...state.decks, deck('deck-2')],
      activeDeckId: 'deck-2',
    }));
    useHistoryStore.getState().record(match());
    await settle();

    expect(calls).toEqual(['initialize', 'deck', 'active', 'match']);
    stop();
    expect(mockEngine.stop).toHaveBeenCalledOnce();
  });

  it('keeps the local deck and reports an error when background upload fails', async () => {
    const mockEngine = engine({
      enqueueDeck: vi.fn(async () => { throw new Error('network down'); }),
    });
    const stop = startCloudSyncRuntime({ enabled: true, engine: mockEngine, eventTarget: window });
    await settle();

    useDecksStore.getState().update('deck-1', { name: 'Still local' });
    await settle();

    expect(useDecksStore.getState().byId('deck-1')?.name).toBe('Still local');
    expect(useCloudSyncStatusStore.getState().status).toMatchObject({
      phase: 'error',
      message: 'CLOUD_SYNC_RUNTIME_FAILED',
    });
    stop();
  });

  it('suppresses remote imports and retries the durable queue after online recovery', async () => {
    const port = createStoreLocalCloudDataPort();
    const mockEngine = engine({
      initialize: vi.fn(async () => {
        port.mergeRemoteDecks([deck('remote-deck')], null);
      }),
    });
    const stop = startCloudSyncRuntime({
      enabled: true,
      engine: mockEngine,
      eventTarget: window,
      isApplyingRemote: port.isApplyingRemote,
    });
    await settle();

    window.dispatchEvent(new Event('online'));
    await settle();

    expect(useDecksStore.getState().byId('remote-deck')).toEqual(deck('remote-deck'));
    expect(mockEngine.enqueueDeck).not.toHaveBeenCalled();
    expect(mockEngine.drain).toHaveBeenCalledWith({ forceRetry: true });
    stop();
  });

  it('recovers a journaled delete after immediate runtime stop and restart', async () => {
    const synced = deck();
    await bindCloudSyncOwner('family@example.com', NOW - 2_000);
    await updateCloudSyncState((state) => {
      state.initialImportCompletedAt = NOW - 2_000;
      state.activeDeckRevision = 1;
      state.deckMetadata[synced.id] = {
        cloudDeckId: synced.id,
        revision: 1,
        lastSyncedModified: synced.modified,
        serverUpdatedAt: NOW - 2_000,
      };
    });
    const remoteDeck = {
      deckId: synced.id,
      name: synced.name,
      partnerCardNum: synced.partner,
      caseCardNum: synced.case,
      cards: synced.cards.map(({ num, count }) => ({ cardNum: num, count })),
      clientModifiedAt: synced.modified,
      revision: 1,
      serverUpdatedAt: NOW - 2_000,
    };
    const dormant = createCloudSyncEngine({
      api: {
        bootstrap: async () => ({
          identity: { email: 'family@example.com' },
          decks: [remoteDeck],
          deletedDecks: [],
          activeDeck: { activeDeckId: synced.id, revision: 1, serverUpdatedAt: NOW - 2_000 },
          stats: { matches: 0, wins: 0, losses: 0, winRate: null },
        }),
        execute: async () => { throw new Error('must not execute before restart'); },
      },
      local: createStoreLocalCloudDataPort(),
      appVersion: '1.0.0',
      now: () => NOW,
    });
    await dormant.initialize();
    const gated: CloudSyncEngine = {
      initialize: vi.fn(async () => undefined),
      stop: () => dormant.stop(),
      drain: (options) => dormant.drain(options),
      journalDeckDelete: (deckId) => dormant.journalDeckDelete(deckId),
      enqueueDeck: (value) => dormant.enqueueDeck(value),
      enqueueDeckDelete: vi.fn(async () => undefined),
      enqueueActiveDeck: (deckId) => dormant.enqueueActiveDeck(deckId),
      enqueueMatch: (value) => dormant.enqueueMatch(value),
    };
    const stop = startCloudSyncRuntime({ enabled: true, engine: gated, eventTarget: window });

    await useDecksStore.getState().remove(synced.id);
    stop();
    await settle();

    expect(useDecksStore.getState().byId(synced.id)).toBeUndefined();
    expect((await readCloudSyncState()).deckDeleteIntents[synced.id]).toBeDefined();
    expect((await readCloudSyncState()).outbox).toEqual([]);

    const executed: CloudSyncOperation[] = [];
    const recovered = createCloudSyncEngine({
      api: {
        bootstrap: async () => ({
          identity: { email: 'family@example.com' },
          decks: [remoteDeck],
          deletedDecks: [],
          activeDeck: null,
          stats: { matches: 0, wins: 0, losses: 0, winRate: null },
        }),
        execute: async (operation) => {
          executed.push(structuredClone(operation));
          if (operation.kind !== 'deck-delete') throw new Error('unexpected operation');
          return { kind: 'deck-delete', deckId: operation.cloudDeckId, deletedAt: NOW, replayed: false };
        },
      },
      local: createStoreLocalCloudDataPort(),
      appVersion: '1.0.0',
      now: () => NOW,
    });

    await recovered.initialize();

    expect(executed).toHaveLength(1);
    expect(executed[0]?.kind).toBe('deck-delete');
    expect((await readCloudSyncState()).deckDeleteIntents).toEqual({});
    recovered.stop();
  });

  it('keeps the local deck when a different Access owner wins the delete/bootstrap race', async () => {
    const synced = deck();
    await bindCloudSyncOwner('first@example.com', NOW - 2_000);
    await updateCloudSyncState((state) => {
      state.initialImportCompletedAt = NOW - 2_000;
      state.deckMetadata[synced.id] = {
        cloudDeckId: synced.id,
        revision: 1,
        lastSyncedModified: synced.modified,
        serverUpdatedAt: NOW - 2_000,
      };
    });
    let resolveBootstrap!: (value: CloudBootstrap) => void;
    const bootstrap = new Promise<CloudBootstrap>((resolve) => { resolveBootstrap = resolve; });
    const execute = vi.fn();
    const actual = createCloudSyncEngine({
      api: { bootstrap: vi.fn(() => bootstrap), execute },
      local: createStoreLocalCloudDataPort(),
      appVersion: '1.0.0',
      now: () => NOW,
    });
    const stop = startCloudSyncRuntime({ enabled: true, engine: actual, eventTarget: window });

    try {
      const removal = useDecksStore.getState().remove(synced.id);
      await Promise.resolve();
      expect(useDecksStore.getState().byId(synced.id)).toEqual(synced);
      expect((await readCloudSyncState()).deckDeleteIntents).toEqual({});

      resolveBootstrap({
        identity: { email: 'second@example.com' },
        decks: [],
        deletedDecks: [],
        activeDeck: null,
        stats: { matches: 0, wins: 0, losses: 0, winRate: null },
      });
      await expect(removal).rejects.toBeInstanceOf(CloudSyncOwnerMismatchError);
      await settle();

      expect(useDecksStore.getState().byId(synced.id)).toEqual(synced);
      expect((await readCloudSyncState()).deckDeleteIntents).toEqual({});
      expect((await readCloudSyncState()).outbox).toEqual([]);
      expect(execute).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });
});
