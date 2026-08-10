import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudApiError, type CloudApiClient } from '../../meta-app/src/cloud/apiClient';
import { createCloudSyncEngine, type LocalCloudDataPort } from '../../meta-app/src/cloud/syncEngine';
import {
  bindCloudSyncOwner,
  readCloudSyncState,
  updateCloudSyncState,
} from '../../meta-app/src/cloud/storage';
import type {
  CloudBootstrap,
  CloudOperationIdentity,
  CloudOperationResult,
  CloudSyncOperation,
} from '../../meta-app/src/cloud/types';
import type { DeckRecord, MatchRecord } from '../../meta-app/src/data/types';

const NOW = 2_000_000;

function deck(id = 'deck-1'): DeckRecord {
  return {
    id,
    name: `Deck ${id}`,
    partner: 'D08001',
    case: 'D08026',
    cards: [{ num: 'D08002', count: 40 }],
    modified: NOW - 1_000,
  };
}

function match(id = 'match-1', deckId = 'deck-1'): MatchRecord {
  return {
    id,
    sessionId: id,
    recorded: NOW - 500,
    won: true,
    deckName: `Deck ${deckId}`,
    mode: 'solo',
    selfDeckSnapshot: {
      schemaVersion: 1,
      deckId,
      name: `Deck ${deckId}`,
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

function emptyBootstrap(overrides: Partial<CloudBootstrap> = {}): CloudBootstrap {
  return {
    identity: { email: 'family@example.com' },
    decks: [],
    deletedDecks: [],
    activeDeck: null,
    stats: { matches: 0, wins: 0, losses: 0, winRate: null },
    ...overrides,
  };
}

function localPort(initial: { decks?: DeckRecord[]; history?: MatchRecord[]; activeDeckId?: string } = {}): LocalCloudDataPort & {
  decks: DeckRecord[];
  history: MatchRecord[];
  activeDeckId: string;
} {
  const port = {
    decks: initial.decks ?? [],
    history: initial.history ?? [],
    activeDeckId: initial.activeDeckId ?? '',
    snapshot() {
      return {
        decks: structuredClone(port.decks),
        history: structuredClone(port.history),
        activeDeckId: port.activeDeckId,
      };
    },
    mergeRemoteDecks(remoteDecks: readonly DeckRecord[], activeDeckToAdopt: string | null) {
      for (const remote of remoteDecks) {
        const index = port.decks.findIndex((item) => item.id === remote.id);
        if (index === -1) port.decks.push(structuredClone(remote));
        else port.decks[index] = structuredClone(remote);
      }
      if (!port.activeDeckId && activeDeckToAdopt) port.activeDeckId = activeDeckToAdopt;
    },
  };
  return port;
}

function identityFactory(): () => CloudOperationIdentity {
  let sequence = 0;
  return () => ({
    operationId: `operation-${++sequence}`,
    idempotencyKey: `idempotency-key-${sequence.toString().padStart(4, '0')}`,
  });
}

function successResult(operation: CloudSyncOperation, revision = 1): CloudOperationResult {
  switch (operation.kind) {
    case 'deck-put':
      return {
        kind: 'deck-put',
        deck: {
          deckId: operation.payload.deckId,
          name: operation.payload.name,
          partnerCardNum: operation.payload.partnerCardNum,
          caseCardNum: operation.payload.caseCardNum,
          cards: operation.payload.cards,
          clientModifiedAt: operation.payload.clientModifiedAt,
          revision,
          serverUpdatedAt: NOW,
        },
        replayed: false,
      };
    case 'deck-delete':
      return { kind: 'deck-delete', deckId: operation.cloudDeckId, deletedAt: NOW, replayed: false };
    case 'active-deck-put':
      return {
        kind: 'active-deck-put',
        activeDeck: { activeDeckId: operation.payload.activeDeckId, revision, serverUpdatedAt: NOW },
        replayed: false,
      };
    case 'match-post':
      return { kind: 'match-post', matchId: operation.payload.matchId, replayed: false };
  }
}

async function seedSyncedDeck(syncedDeck: DeckRecord): Promise<void> {
  await bindCloudSyncOwner('family@example.com', NOW - 2_000);
  await updateCloudSyncState((state) => {
    state.initialImportCompletedAt = NOW - 2_000;
    state.activeDeckRevision = 1;
    state.deckMetadata[syncedDeck.id] = {
      cloudDeckId: syncedDeck.id,
      revision: 1,
      lastSyncedModified: syncedDeck.modified,
      serverUpdatedAt: NOW - 2_000,
    };
  });
}

function remoteDeck(local: DeckRecord, overrides: Partial<CloudBootstrap['decks'][number]> = {}) {
  return {
    deckId: local.id,
    name: local.name,
    partnerCardNum: local.partner,
    caseCardNum: local.case,
    cards: local.cards.map(({ num, count }) => ({ cardNum: num, count })),
    clientModifiedAt: local.modified,
    revision: 1,
    serverUpdatedAt: NOW - 2_000,
    ...overrides,
  };
}

describe('local-first cloud sync engine', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('uploads decks before active selection and matches, then records server revisions', async () => {
    const executed: CloudSyncOperation[] = [];
    const api: CloudApiClient = {
      bootstrap: async () => emptyBootstrap(),
      execute: async (operation) => {
        executed.push(structuredClone(operation));
        return successResult(operation);
      },
    };
    const local = localPort({ decks: [deck()], history: [match()], activeDeckId: 'deck-1' });
    const engine = createCloudSyncEngine({
      api,
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(executed.map((operation) => operation.kind))
      .toEqual(['deck-put', 'active-deck-put', 'match-post']);
    expect(executed[2]).toMatchObject({
      kind: 'match-post',
      payload: { deckRevision: 1 },
    });
    const state = await readCloudSyncState();
    expect(state.outbox).toEqual([]);
    expect(state.deckMetadata['deck-1']?.revision).toBe(1);
    expect(state.activeDeckRevision).toBe(1);
    expect(state.uploadedMatchIds['match-1']).toBe(NOW);
    expect(state.initialImportCompletedAt).toBe(NOW);
  });

  it('retries an unknown transport outcome with the exact same payload and idempotency key', async () => {
    const attempts: CloudSyncOperation[] = [];
    let fail = true;
    const api: CloudApiClient = {
      bootstrap: async () => emptyBootstrap(),
      execute: async (operation) => {
        attempts.push(structuredClone(operation));
        if (fail) {
          fail = false;
          throw new CloudApiError('NETWORK_UNAVAILABLE', {
            status: null,
            retryable: true,
            conflict: false,
            offline: true,
            retryAfterMs: null,
          });
        }
        return successResult(operation);
      },
    };
    const engine = createCloudSyncEngine({
      api,
      local: localPort({ decks: [deck()] }),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();
    expect((await readCloudSyncState()).outbox).toHaveLength(1);
    await engine.drain({ forceRetry: true });

    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.idempotencyKey).toBe(attempts[0]?.idempotencyKey);
    expect(attempts[1]?.kind === 'deck-put' && attempts[1].payload)
      .toEqual(attempts[0]?.kind === 'deck-put' && attempts[0].payload);
    expect((await readCloudSyncState()).outbox).toEqual([]);
  });

  it('retains local data and the durable operation when the server reports a conflict', async () => {
    const local = localPort({ decks: [deck()] });
    const phases: string[] = [];
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => emptyBootstrap(),
        execute: async () => {
          throw new CloudApiError('CONFLICT', {
            status: 409,
            retryable: false,
            conflict: true,
            offline: false,
            retryAfterMs: null,
          });
        },
      },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
      onStatus: (status) => phases.push(status.phase),
    });

    await engine.initialize();

    expect(local.decks).toEqual([deck()]);
    const state = await readCloudSyncState();
    expect(state.outbox).toHaveLength(1);
    expect(state.conflicts).toContainEqual(expect.objectContaining({
      kind: 'deck', resourceId: 'deck-1', code: 'CONFLICT',
    }));
    expect(phases.at(-1)).toBe('conflict');
  });

  it('imports a server-only deck on a second device without deleting its local data', async () => {
    const existing = deck('local-existing');
    const local = localPort({ decks: [existing], activeDeckId: existing.id });
    const remote = deck('remote-deck');
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => emptyBootstrap({
          decks: [{
            deckId: remote.id,
            name: remote.name,
            partnerCardNum: remote.partner,
            caseCardNum: remote.case,
            cards: remote.cards.map(({ num, count }) => ({ cardNum: num, count })),
            clientModifiedAt: remote.modified,
            revision: 2,
            serverUpdatedAt: NOW,
          }],
        }),
        execute: async (operation) => successResult(operation),
      },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(local.decks.map((item) => item.id).sort())
      .toEqual(['local-existing', 'remote-deck']);
    expect(local.decks.find((item) => item.id === existing.id)).toEqual(existing);
  });

  it('pulls a newer remote deck on the next startup when the local copy is unchanged', async () => {
    const synced = deck();
    await seedSyncedDeck(synced);
    const local = localPort({ decks: [synced], activeDeckId: synced.id });
    const execute = vi.fn();
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => emptyBootstrap({
          activeDeck: { activeDeckId: synced.id, revision: 1, serverUpdatedAt: NOW - 2_000 },
          decks: [remoteDeck(synced, {
            name: 'Edited on device B',
            clientModifiedAt: NOW - 100,
            revision: 2,
            serverUpdatedAt: NOW - 50,
          })],
        }),
        execute,
      },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(local.decks[0]?.name).toBe('Edited on device B');
    expect(execute).not.toHaveBeenCalled();
    expect((await readCloudSyncState()).deckMetadata['deck-1']?.revision).toBe(2);
  });

  it('preserves both-device edits locally and records a conflict instead of overwriting', async () => {
    const synced = deck();
    await seedSyncedDeck(synced);
    const localEdit = { ...synced, name: 'Edited on device A', modified: NOW - 100 };
    const local = localPort({ decks: [localEdit], activeDeckId: synced.id });
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => emptyBootstrap({
          activeDeck: { activeDeckId: synced.id, revision: 1, serverUpdatedAt: NOW - 2_000 },
          decks: [remoteDeck(synced, {
            name: 'Edited on device B',
            clientModifiedAt: NOW - 90,
            revision: 2,
            serverUpdatedAt: NOW - 50,
          })],
        }),
        execute: vi.fn(),
      },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(local.decks).toEqual([localEdit]);
    expect((await readCloudSyncState()).conflicts).toContainEqual(expect.objectContaining({
      kind: 'deck',
      resourceId: 'deck-1',
      code: 'DECK_BOTH_CHANGED',
    }));
  });

  it('recovers a locally saved match that was not queued before the previous tab closed', async () => {
    const synced = deck();
    await seedSyncedDeck(synced);
    const executed: CloudSyncOperation[] = [];
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => emptyBootstrap({
          activeDeck: { activeDeckId: synced.id, revision: 1, serverUpdatedAt: NOW - 2_000 },
          decks: [remoteDeck(synced)],
        }),
        execute: async (operation) => {
          executed.push(structuredClone(operation));
          return successResult(operation);
        },
      },
      local: localPort({ decks: [synced], activeDeckId: synced.id, history: [match()] }),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(executed.map((operation) => operation.kind)).toEqual(['match-post']);
    expect((await readCloudSyncState()).uploadedMatchIds['match-1']).toBe(NOW);
  });

  it('limits one drain wave to four requests to stay below the server minute cap', async () => {
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const history = Array.from({ length: 8 }, (_, index) => match(`match-${index + 1}`));
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap(), execute },
      local: localPort({ decks: [deck()], history }),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();

    expect(execute).toHaveBeenCalledTimes(4);
    expect((await readCloudSyncState()).outbox).toHaveLength(5);
  });

  it('shares the four-request minute budget across separate enqueue drains', async () => {
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap(), execute },
      local: localPort(),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });
    await engine.initialize();

    for (let index = 1; index <= 6; index += 1) {
      await engine.enqueueDeck(deck(`deck-${index}`));
    }

    expect(execute).toHaveBeenCalledTimes(4);
    expect((await readCloudSyncState()).outbox).toHaveLength(2);
  });

  it('automatically resumes the durable outbox when each minute window opens', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let now = NOW;
    const executedAt: number[] = [];
    let resolveOneRemaining!: () => void;
    let resolveFullyDrained!: () => void;
    const oneRemaining = new Promise<void>((resolve) => { resolveOneRemaining = resolve; });
    const fullyDrained = new Promise<void>((resolve) => { resolveFullyDrained = resolve; });
    const execute = vi.fn(async (operation: CloudSyncOperation) => {
      executedAt.push(now);
      return successResult(operation);
    });
    const history = Array.from({ length: 8 }, (_, index) => match(`match-${index + 1}`));
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap(), execute },
      local: localPort({ decks: [deck()], history }),
      appVersion: '1.0.0',
      now: () => now,
      createIdentity: identityFactory(),
      onStatus: (status) => {
        if (status.pendingCount === 1 && status.message === 'MINUTE_BUDGET_PAUSE') {
          resolveOneRemaining();
        }
        if (status.pendingCount === 0 && status.phase === 'online' && executedAt.length === 9) {
          resolveFullyDrained();
        }
      },
    });

    try {
      await engine.initialize();
      expect(execute).toHaveBeenCalledTimes(4);
      expect((await readCloudSyncState()).outbox).toHaveLength(5);
      expect(vi.getTimerCount()).toBe(1);

      now += 60_000;
      await vi.advanceTimersByTimeAsync(60_000);
      await oneRemaining;
      expect(execute).toHaveBeenCalledTimes(8);
      expect((await readCloudSyncState()).outbox).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(1);

      now += 60_000;
      await vi.advanceTimersByTimeAsync(60_000);
      await fullyDrained;
      expect(execute).toHaveBeenCalledTimes(9);
      expect((await readCloudSyncState()).outbox).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      expect(executedAt.filter((timestamp) => timestamp === NOW)).toHaveLength(4);
      expect(executedAt.filter((timestamp) => timestamp === NOW + 60_000)).toHaveLength(4);
    } finally {
      engine.stop();
      vi.useRealTimers();
    }
  });

  it('refuses a deck deletion while the current Access owner cannot be verified', async () => {
    const synced = deck();
    await seedSyncedDeck(synced);
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const local = localPort({ decks: [synced] });
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => {
          throw new CloudApiError('NETWORK_UNAVAILABLE', {
            status: null,
            retryable: true,
            conflict: false,
            offline: true,
            retryAfterMs: null,
          });
        },
        execute,
      },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();
    await expect(engine.journalDeckDelete(synced.id)).rejects.toThrow('CLOUD_SYNC_OWNER_NOT_VERIFIED');

    expect(execute).not.toHaveBeenCalled();
    expect(local.decks).toEqual([synced]);
    expect((await readCloudSyncState()).deckDeleteIntents).toEqual({});
    expect((await readCloudSyncState()).outbox).toEqual([]);
    engine.stop();
  });

  it('cancels the pending minute-window wake when the engine stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let now = NOW;
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const history = Array.from({ length: 8 }, (_, index) => match(`match-${index + 1}`));
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap(), execute },
      local: localPort({ decks: [deck()], history }),
      appVersion: '1.0.0',
      now: () => now,
      createIdentity: identityFactory(),
    });

    try {
      await engine.initialize();
      expect(execute).toHaveBeenCalledTimes(4);
      expect(vi.getTimerCount()).toBe(1);

      engine.stop();
      expect(vi.getTimerCount()).toBe(0);
      now += 60_000;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(execute).toHaveBeenCalledTimes(4);
      expect((await readCloudSyncState()).outbox).toHaveLength(5);
    } finally {
      engine.stop();
      vi.useRealTimers();
    }
  });

  it('never sends a persisted delete intent under a different verified owner', async () => {
    await bindCloudSyncOwner('first@example.com', NOW - 1);
    await updateCloudSyncState((state) => {
      state.initialImportCompletedAt = NOW - 1;
      state.deckMetadata['deck-1'] = {
        cloudDeckId: 'deck-1',
        revision: 1,
        lastSyncedModified: NOW - 1_000,
        serverUpdatedAt: NOW - 1,
      };
      state.deckDeleteIntents['deck-1'] = {
        cloudDeckId: 'deck-1',
        expectedRevision: 1,
        deletedAt: NOW,
      };
    });
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap({ identity: { email: 'second@example.com' } }), execute },
      local: localPort(),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();
    await engine.drain({ forceRetry: true });

    expect(execute).not.toHaveBeenCalled();
    expect((await readCloudSyncState()).deckDeleteIntents['deck-1']).toBeDefined();
    expect((await readCloudSyncState()).outbox).toEqual([]);
  });

  it('stops before bootstrap migration when another verified user owns the browser dataset', async () => {
    await bindCloudSyncOwner('first@example.com', NOW - 1);
    const execute = vi.fn();
    const local = localPort({ decks: [deck()] });
    const engine = createCloudSyncEngine({
      api: { bootstrap: async () => emptyBootstrap({ identity: { email: 'second@example.com' } }), execute },
      local,
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();
    await engine.enqueueDeck(deck('must-not-send'));
    await engine.drain({ forceRetry: true });

    expect(execute).not.toHaveBeenCalled();
    expect(local.decks).toEqual([deck()]);
    expect((await readCloudSyncState()).ownerEmail).toBe('first@example.com');
    expect((await readCloudSyncState()).outbox).toEqual([]);
  });

  it('re-authenticates on reconnect after bootstrap was initially offline', async () => {
    let online = false;
    const execute = vi.fn(async (operation: CloudSyncOperation) => successResult(operation));
    const engine = createCloudSyncEngine({
      api: {
        bootstrap: async () => {
          if (!online) {
            throw new CloudApiError('NETWORK_UNAVAILABLE', {
              status: null,
              retryable: true,
              conflict: false,
              offline: true,
              retryAfterMs: null,
            });
          }
          return emptyBootstrap();
        },
        execute,
      },
      local: localPort({ decks: [deck()] }),
      appVersion: '1.0.0',
      now: () => NOW,
      createIdentity: identityFactory(),
    });

    await engine.initialize();
    online = true;
    await engine.drain({ forceRetry: true });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0].kind).toBe('deck-put');
  });
});
