import {
  assertReplayLogV3,
  canonicalReplayJson,
  type ReplayLogV3,
} from '@/ai/replay/state-frame';
import { projectReplayLogForViewer } from '@/ui/services/replayViewerProjection';
import type { HistoryReplayRefV1, MatchRecord } from '../data/types';
import { normalizeHistoryRow, useHistoryStore } from '../state/historyStore';

const DB_NAME = 'conan-history-replay-v1';
const DB_VERSION = 1;
const ROW_STORE = 'historyRows';
const ARTIFACT_STORE = 'replayArtifacts';
const MAX_RECORDS = 500;
export const MAX_REPLAY_ARTIFACT_BYTES = 32 * 1024 * 1024;

export type StoredReplayArtifactV1 = {
  storageSchemaVersion: 1;
  artifactId: string;
  rowId: string;
  sessionId: string;
  digest: HistoryReplayRefV1['digest'];
  byteLength: number;
  log: ReplayLogV3;
};

export type HistoryReplayBundleV1 = {
  row: MatchRecord & { replayRef: HistoryReplayRefV1 };
  artifact: StoredReplayArtifactV1;
};

export function assertReplayArtifactByteLength(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error('Invalid replay artifact byte length');
  }
  if (byteLength > MAX_REPLAY_ARTIFACT_BYTES) {
    throw new Error('Replay artifact exceeds the storage limit');
  }
}

function assertReplayModeMatchesHistory(row: MatchRecord, log: ReplayLogV3): void {
  const expectedViewerMode = row.mode === 'solo'
    ? 'solo-self'
    : row.mode === 'observe'
      ? 'spectator'
      : null;
  if (expectedViewerMode === null || log.viewerMode !== expectedViewerMode) {
    throw new Error('Replay viewer mode does not match history mode');
  }
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
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

async function sha256(text: string): Promise<HistoryReplayRefV1['digest']> {
  if (!globalThis.crypto?.subtle) throw new Error('Replay digest service is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256-${hex}`;
}

export async function prepareHistoryReplayBundle(
  rawRow: MatchRecord,
  log: ReplayLogV3,
): Promise<HistoryReplayBundleV1> {
  assertReplayLogV3(log);
  const row = normalizeHistoryRow(rawRow);
  if (!row || !row.sessionId || row.sessionId !== log.sessionId || row.id !== log.sessionId) {
    throw new Error('History row does not own this replay session');
  }
  assertReplayModeMatchesHistory(row, log);
  // Defence in depth: callers may hand this repository a valid V3 artifact
  // created before live capture-time projection. IndexedDB must never receive
  // identities outside the artifact's viewer contract.
  const projectedLog = projectReplayLogForViewer(log);
  const serialized = canonicalReplayJson(projectedLog);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  assertReplayArtifactByteLength(byteLength);
  const digest = await sha256(serialized);
  const replayRef: HistoryReplayRefV1 = {
    storageSchemaVersion: 1,
    replaySchemaVersion: 3,
    artifactId: log.artifactId,
    digest,
    byteLength,
  };
  const replayRow = { ...row, replayRef };
  return {
    row: replayRow,
    artifact: {
      storageSchemaVersion: 1,
      artifactId: log.artifactId,
      rowId: row.id,
      sessionId: log.sessionId,
      digest,
      byteLength,
      log: structuredClone(projectedLog),
    },
  };
}

export function validateStoredReplayArtifact(value: unknown, row: MatchRecord): ReplayLogV3 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid replay artifact');
  const artifact = value as Partial<StoredReplayArtifactV1>;
  const ref = row.replayRef;
  if (!ref || artifact.storageSchemaVersion !== 1) throw new Error('Replay reference is unavailable');
  assertReplayArtifactByteLength(ref.byteLength);
  if (artifact.artifactId !== ref.artifactId || artifact.rowId !== row.id) throw new Error('Replay artifact ownership mismatch');
  if (!row.sessionId || artifact.sessionId !== row.sessionId) throw new Error('Replay artifact session mismatch');
  if (artifact.digest !== ref.digest || artifact.byteLength !== ref.byteLength) throw new Error('Replay artifact digest mismatch');
  assertReplayLogV3(artifact.log);
  if (artifact.log.artifactId !== ref.artifactId || artifact.log.sessionId !== row.sessionId) {
    throw new Error('Replay log ownership mismatch');
  }
  assertReplayModeMatchesHistory(row, artifact.log);
  return artifact.log;
}

async function verifyStoredReplayArtifact(value: unknown, row: MatchRecord): Promise<ReplayLogV3> {
  const log = validateStoredReplayArtifact(value, row);
  const serialized = canonicalReplayJson(log);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  assertReplayArtifactByteLength(byteLength);
  const digest = await sha256(serialized);
  if (byteLength !== row.replayRef!.byteLength || digest !== row.replayRef!.digest) {
    throw new Error('Replay artifact integrity check failed');
  }
  return log;
}

export async function saveHistoryReplay(rawRow: MatchRecord, log: ReplayLogV3): Promise<MatchRecord> {
  const bundle = await prepareHistoryReplayBundle(rawRow, log);
  const database = await openDatabase();
  const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readwrite');
  const done = transactionDone(transaction);
  try {
    const rows = transaction.objectStore(ROW_STORE);
    const artifacts = transaction.objectStore(ARTIFACT_STORE);
    const existingRow = await requestValue(rows.get(bundle.row.id)) as MatchRecord | undefined;
    const existingArtifact = await requestValue(artifacts.get(bundle.artifact.artifactId)) as StoredReplayArtifactV1 | undefined;
    if (existingRow?.replayRef && existingRow.replayRef.digest !== bundle.row.replayRef.digest) {
      throw new Error('History session already owns a different replay');
    }
    if (existingArtifact && existingArtifact.digest !== bundle.artifact.digest) {
      throw new Error('Replay artifact ID collision');
    }
    rows.put(bundle.row);
    artifacts.put(bundle.artifact);
    const allRows = (await requestValue(rows.getAll()) as MatchRecord[])
      .sort((a, b) => b.recorded - a.recorded);
    for (const expired of allRows.slice(MAX_RECORDS)) {
      rows.delete(expired.id);
      if (expired.replayRef) artifacts.delete(expired.replayRef.artifactId);
    }
    await done;
    return bundle.row;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // The transaction may already have completed or aborted after an async request error.
    }
    await done.catch(() => undefined);
    throw error;
  } finally {
    database.close();
  }
}

export async function listStoredHistoryRows(): Promise<MatchRecord[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ROW_STORE, 'readonly');
    const rows = await requestValue(transaction.objectStore(ROW_STORE).getAll()) as MatchRecord[];
    await transactionDone(transaction);
    return rows.map(normalizeHistoryRow)
      .filter((row): row is MatchRecord => row !== undefined)
      .sort((a, b) => b.recorded - a.recorded)
      .slice(0, MAX_RECORDS);
  } finally {
    database.close();
  }
}

export async function loadHistoryReplayArtifact(artifactId: string): Promise<ReplayLogV3> {
  if (!artifactId.trim()) throw new Error('Replay artifact ID is required');
  const database = await openDatabase();
  try {
    const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readonly');
    const artifact = await requestValue(transaction.objectStore(ARTIFACT_STORE).get(artifactId)) as StoredReplayArtifactV1 | undefined;
    if (!artifact) throw new Error('Replay artifact was not found');
    const rawRow = await requestValue(transaction.objectStore(ROW_STORE).get(artifact.rowId));
    await transactionDone(transaction);
    const row = normalizeHistoryRow(rawRow);
    if (!row) throw new Error('Replay history row was not found');
    return await verifyStoredReplayArtifact(artifact, row);
  } finally {
    database.close();
  }
}

export async function clearStoredHistoryReplays(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readwrite');
    transaction.objectStore(ROW_STORE).clear();
    transaction.objectStore(ARTIFACT_STORE).clear();
    await transactionDone(transaction);
    useHistoryStore.getState().clear();
  } finally {
    database.close();
  }
}
