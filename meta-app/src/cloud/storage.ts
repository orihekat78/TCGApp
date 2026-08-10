import type { CloudSyncOperation, CloudSyncState } from './types';

const DATABASE_NAME = 'conan-cloud-sync-v1';
const DATABASE_VERSION = 1;
const STATE_STORE = 'syncState';
const STATE_KEY = 'current';
export const MAX_CLOUD_OUTBOX_OPERATIONS = 750;

export class CloudSyncOwnerMismatchError extends Error {
  constructor() {
    super('CLOUD_SYNC_OWNER_MISMATCH');
    this.name = 'CloudSyncOwnerMismatchError';
  }
}

function defaultState(): CloudSyncState {
  return {
    schemaVersion: 1,
    ownerEmail: null,
    ownerBoundAt: null,
    initialImportCompletedAt: null,
    outbox: [],
    deckMetadata: {},
    deckDeleteIntents: {},
    activeDeckRevision: null,
    uploadedMatchIds: {},
    conflicts: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDeleteIntent(value: unknown): boolean {
  return isRecord(value)
    && typeof value.cloudDeckId === 'string'
    && value.cloudDeckId.length > 0
    && value.cloudDeckId.length <= 128
    && (value.expectedRevision === null
      || (Number.isSafeInteger(value.expectedRevision) && Number(value.expectedRevision) >= 1))
    && Number.isSafeInteger(value.deletedAt)
    && Number(value.deletedAt) >= 0;
}

function readStoredState(value: unknown): CloudSyncState {
  if (value === undefined) return defaultState();
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error('CLOUD_SYNC_STATE_INVALID');
  }
  const deckDeleteIntents = value.deckDeleteIntents ?? {};
  if (
    (value.ownerEmail !== null && typeof value.ownerEmail !== 'string')
    || (value.ownerBoundAt !== null && !Number.isSafeInteger(value.ownerBoundAt))
    || (value.initialImportCompletedAt !== null && !Number.isSafeInteger(value.initialImportCompletedAt))
    || !Array.isArray(value.outbox)
    || !isRecord(value.deckMetadata)
    || !isRecord(deckDeleteIntents)
    || !Object.values(deckDeleteIntents).every(isDeleteIntent)
    || (value.activeDeckRevision !== null && !Number.isSafeInteger(value.activeDeckRevision))
    || !isRecord(value.uploadedMatchIds)
    || !Array.isArray(value.conflicts)
  ) {
    throw new Error('CLOUD_SYNC_STATE_INVALID');
  }
  return {
    ...structuredClone(value),
    deckDeleteIntents: structuredClone(deckDeleteIntents),
  } as CloudSyncState;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('CLOUD_SYNC_STORAGE_READ_FAILED'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('CLOUD_SYNC_STORAGE_WRITE_FAILED'));
    transaction.onabort = () => reject(transaction.error ?? new Error('CLOUD_SYNC_STORAGE_WRITE_ABORTED'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STATE_STORE)) {
      database.createObjectStore(STATE_STORE);
    }
  };
  return requestResult(request);
}

export async function readCloudSyncState(): Promise<CloudSyncState> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STATE_STORE, 'readonly');
    const value = await requestResult(transaction.objectStore(STATE_STORE).get(STATE_KEY));
    await transactionDone(transaction);
    return readStoredState(value);
  } finally {
    database.close();
  }
}

export async function updateCloudSyncState(
  mutate: (state: CloudSyncState) => void,
): Promise<CloudSyncState> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STATE_STORE, 'readwrite');
    const store = transaction.objectStore(STATE_STORE);
    const current = readStoredState(await requestResult(store.get(STATE_KEY)));
    const next = structuredClone(current);
    try {
      mutate(next);
      if (next.schemaVersion !== 1) throw new Error('CLOUD_SYNC_STATE_INVALID');
      store.put(structuredClone(next), STATE_KEY);
    } catch (error) {
      transaction.abort();
      try {
        await transactionDone(transaction);
      } catch {
        // Preserve the original mutation error.
      }
      throw error;
    }
    await transactionDone(transaction);
    return structuredClone(next);
  } finally {
    database.close();
  }
}

function normalizedEmail(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('CLOUD_SYNC_EMAIL_INVALID');
  }
  return email;
}

export function bindCloudSyncOwner(rawEmail: string, now: number): Promise<CloudSyncState> {
  const email = normalizedEmail(rawEmail);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('CLOUD_SYNC_TIME_INVALID');
  return updateCloudSyncState((state) => {
    if (state.ownerEmail !== null && state.ownerEmail !== email) {
      throw new CloudSyncOwnerMismatchError();
    }
    if (state.ownerEmail === null) {
      state.ownerEmail = email;
      state.ownerBoundAt = now;
    }
  });
}

export function enqueueCloudSyncOperations(
  operations: readonly CloudSyncOperation[],
): Promise<CloudSyncState> {
  return updateCloudSyncState((state) => {
    if (state.outbox.length + operations.length > MAX_CLOUD_OUTBOX_OPERATIONS) {
      throw new Error('CLOUD_SYNC_OUTBOX_FULL');
    }
    const operationIds = new Set(state.outbox.map((operation) => operation.operationId));
    const idempotencyKeys = new Set(state.outbox.map((operation) => operation.idempotencyKey));
    for (const operation of operations) {
      if (operationIds.has(operation.operationId) || idempotencyKeys.has(operation.idempotencyKey)) {
        throw new Error('CLOUD_SYNC_OPERATION_DUPLICATE');
      }
      operationIds.add(operation.operationId);
      idempotencyKeys.add(operation.idempotencyKey);
      state.outbox.push(structuredClone(operation));
    }
  });
}

export function removeCloudSyncOperation(operationId: string): Promise<CloudSyncState> {
  return updateCloudSyncState((state) => {
    state.outbox = state.outbox.filter((operation) => operation.operationId !== operationId);
  });
}
