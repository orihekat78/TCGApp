import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CloudSyncOwnerMismatchError,
  bindCloudSyncOwner,
  enqueueCloudSyncOperations,
  readCloudSyncState,
  removeCloudSyncOperation,
  updateCloudSyncState,
} from '../../meta-app/src/cloud/storage';
import type { CloudSyncOperation } from '../../meta-app/src/cloud/types';

function deckOperation(operationId = 'op-1'): CloudSyncOperation {
  return {
    kind: 'deck-put',
    operationId,
    idempotencyKey: `idem-${operationId}-000000000000`,
    createdAt: 1_000,
    attempts: 0,
    nextAttemptAt: 1_000,
    localDeckId: 'deck-local',
    payload: {
      deckId: 'deck-local',
      name: '家族デッキ',
      partnerCardNum: 'D08001',
      caseCardNum: 'D08026',
      cards: [{ cardNum: 'D08002', count: 40 }],
      clientModifiedAt: 900,
      expectedRevision: null,
    },
  };
}

describe('cloud sync IndexedDB storage', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('starts empty and persists owner, metadata, and outbox across repository calls', async () => {
    expect(await readCloudSyncState()).toMatchObject({
      schemaVersion: 1,
      ownerEmail: null,
      initialImportCompletedAt: null,
      outbox: [],
      deckMetadata: {},
      deckDeleteIntents: {},
    });

    await bindCloudSyncOwner(' Family@Example.COM ', 1_000);
    await enqueueCloudSyncOperations([deckOperation()]);
    await updateCloudSyncState((state) => {
      state.deckMetadata['deck-local'] = {
        cloudDeckId: 'deck-local',
        revision: 2,
        lastSyncedModified: 900,
        serverUpdatedAt: 950,
      };
      state.deckDeleteIntents['deleted-deck'] = {
        cloudDeckId: 'deleted-deck',
        expectedRevision: 3,
        deletedAt: 975,
      };
    });

    const reloaded = await readCloudSyncState();
    expect(reloaded.ownerEmail).toBe('family@example.com');
    expect(reloaded.ownerBoundAt).toBe(1_000);
    expect(reloaded.outbox).toEqual([deckOperation()]);
    expect(reloaded.deckMetadata['deck-local']?.revision).toBe(2);
    expect(reloaded.deckDeleteIntents['deleted-deck']).toEqual({
      cloudDeckId: 'deleted-deck',
      expectedRevision: 3,
      deletedAt: 975,
    });
  });

  it('refuses to bind a shared browser dataset to a different verified email', async () => {
    await bindCloudSyncOwner('first@example.com', 1_000);

    await expect(bindCloudSyncOwner('second@example.com', 2_000))
      .rejects.toBeInstanceOf(CloudSyncOwnerMismatchError);

    expect((await readCloudSyncState()).ownerEmail).toBe('first@example.com');
  });

  it('keeps an immutable payload and idempotency key until explicit completion', async () => {
    const operation = deckOperation();
    await enqueueCloudSyncOperations([operation]);

    const firstRead = (await readCloudSyncState()).outbox[0];
    const secondRead = (await readCloudSyncState()).outbox[0];
    expect(firstRead).toEqual(operation);
    expect(secondRead).toEqual(operation);

    if (firstRead?.kind === 'deck-put') firstRead.payload.name = 'mutated copy';
    expect((await readCloudSyncState()).outbox[0]).toEqual(operation);

    await removeCloudSyncOperation(operation.operationId);
    expect((await readCloudSyncState()).outbox).toEqual([]);
  });

  it('rejects duplicate operation and idempotency identities without altering durable state', async () => {
    const operation = deckOperation();
    await enqueueCloudSyncOperations([operation]);

    await expect(enqueueCloudSyncOperations([deckOperation()]))
      .rejects.toThrow(/duplicate/i);
    await expect(enqueueCloudSyncOperations([{
      ...deckOperation('op-2'),
      idempotencyKey: operation.idempotencyKey,
    }])).rejects.toThrow(/duplicate/i);

    expect((await readCloudSyncState()).outbox).toEqual([operation]);
  });

  it('writes inside the read success event before Safari can deactivate the transaction', async () => {
    const originalGet = IDBObjectStore.prototype.get;
    const originalPut = IDBObjectStore.prototype.put;
    let requestEventActive = false;

    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (...args) {
      const request = originalGet.apply(this, args);
      let successHandler: ((this: IDBRequest, event: Event) => unknown) | null = null;
      Object.defineProperty(request, 'onsuccess', {
        configurable: true,
        enumerable: true,
        get() {
          if (!successHandler) return null;
          return function wrappedSuccess(this: IDBRequest, event: Event) {
            requestEventActive = true;
            try {
              return successHandler?.call(this, event);
            } finally {
              requestEventActive = false;
            }
          };
        },
        set(handler) {
          successHandler = handler;
        },
      });
      return request;
    });
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
      if (!requestEventActive) {
        throw new DOMException('The transaction is inactive', 'TransactionInactiveError');
      }
      return originalPut.apply(this, args);
    });

    await updateCloudSyncState((state) => {
      state.initialImportCompletedAt = 1_000;
    });

    expect((await readCloudSyncState()).initialImportCompletedAt).toBe(1_000);
  });
});
