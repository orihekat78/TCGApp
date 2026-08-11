import type { MatchRecord } from '../data/types';
import { normalizeHistoryRow } from '../state/historyStore';

const DB_NAME = 'conan-history-replay-v1';
const DB_VERSION = 1;

export const ROW_STORE = 'historyRows';
export const ARTIFACT_STORE = 'replayArtifacts';
export const MAX_HISTORY_RECORDS = 500;

export function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

export function openHistoryReplayDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Replay storage is unavailable'));
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ROW_STORE)) {
        const rows = database.createObjectStore(ROW_STORE, { keyPath: 'id' });
        rows.createIndex('recorded', 'recorded');
      }
      if (!database.objectStoreNames.contains(ARTIFACT_STORE)) {
        database.createObjectStore(ARTIFACT_STORE, { keyPath: 'artifactId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Replay storage could not be opened'));
    request.onblocked = () => reject(new Error('Replay storage upgrade is blocked'));
  });
}

export async function listStoredHistoryRows(): Promise<MatchRecord[]> {
  const database = await openHistoryReplayDatabase();
  try {
    const transaction = database.transaction(ROW_STORE, 'readonly');
    const rows = await requestValue(transaction.objectStore(ROW_STORE).getAll()) as MatchRecord[];
    await transactionDone(transaction);
    return rows.map(normalizeHistoryRow)
      .filter((row): row is MatchRecord => row !== undefined)
      .sort((a, b) => b.recorded - a.recorded)
      .slice(0, MAX_HISTORY_RECORDS);
  } finally {
    database.close();
  }
}
