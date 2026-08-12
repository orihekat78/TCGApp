import {
  assertReplayLogV3,
  canonicalReplayJson,
  type ReplayLogV3,
} from '@/ai/replay/state-frame';
import { projectReplayLogForViewer } from '@/ui/services/replayViewerProjection';
import type { HistoryReplayRefV1, MatchRecord } from '../data/types';
import { normalizeHistoryRow, useHistoryStore } from '../state/historyStore';
import {
  ARTIFACT_STORE,
  MAX_HISTORY_RECORDS,
  openHistoryReplayDatabase,
  requestValue,
  ROW_STORE,
  transactionDone,
} from './historyRowsRepository';

export { listStoredHistoryRows } from './historyRowsRepository';
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
  const database = await openHistoryReplayDatabase();
  try {
    const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readwrite');
    const rows = transaction.objectStore(ROW_STORE);
    const artifacts = transaction.objectStore(ARTIFACT_STORE);
    return await new Promise<MatchRecord>((resolve, reject) => {
      let originalError: unknown;
      let settled = false;
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error: unknown) => {
        originalError = error;
        try {
          transaction.abort();
        } catch {
          rejectOnce(error);
        }
      };
      const rememberRequestError = (request: IDBRequest) => {
        request.onerror = () => {
          originalError ??= request.error ?? new Error('IndexedDB request failed');
        };
      };

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(bundle.row);
      };
      transaction.onerror = () => {
        rejectOnce(originalError ?? transaction.error ?? new Error('IndexedDB transaction failed'));
      };
      transaction.onabort = () => {
        rejectOnce(originalError ?? transaction.error ?? new Error('IndexedDB transaction aborted'));
      };

      const existingRowRequest = rows.get(bundle.row.id);
      rememberRequestError(existingRowRequest);
      existingRowRequest.onsuccess = () => {
        try {
          const existingRow = existingRowRequest.result as MatchRecord | undefined;
          if (existingRow?.replayRef && existingRow.replayRef.digest !== bundle.row.replayRef.digest) {
            throw new Error('History session already owns a different replay');
          }

          const existingArtifactRequest = artifacts.get(bundle.artifact.artifactId);
          rememberRequestError(existingArtifactRequest);
          existingArtifactRequest.onsuccess = () => {
            try {
              const existingArtifact = existingArtifactRequest.result as StoredReplayArtifactV1 | undefined;
              if (existingArtifact && existingArtifact.digest !== bundle.artifact.digest) {
                throw new Error('Replay artifact ID collision');
              }

              // Keep each follow-up request inside the preceding success event.
              // Safari may otherwise deactivate this read/write transaction.
              const rowWrite = rows.put(bundle.row);
              const artifactWrite = artifacts.put(bundle.artifact);
              rememberRequestError(rowWrite);
              rememberRequestError(artifactWrite);

              const allRowsRequest = rows.getAll();
              rememberRequestError(allRowsRequest);
              allRowsRequest.onsuccess = () => {
                try {
                  const allRows = (allRowsRequest.result as MatchRecord[])
                    .sort((a, b) => b.recorded - a.recorded);
                  for (const expired of allRows.slice(MAX_HISTORY_RECORDS)) {
                    const rowDelete = rows.delete(expired.id);
                    rememberRequestError(rowDelete);
                    if (expired.replayRef) {
                      const artifactDelete = artifacts.delete(expired.replayRef.artifactId);
                      rememberRequestError(artifactDelete);
                    }
                  }
                } catch (error) {
                  abortWith(error);
                }
              };
            } catch (error) {
              abortWith(error);
            }
          };
        } catch (error) {
          abortWith(error);
        }
      };
    });
  } finally {
    database.close();
  }
}

export async function loadHistoryReplayArtifact(artifactId: string): Promise<ReplayLogV3> {
  if (!artifactId.trim()) throw new Error('Replay artifact ID is required');
  const database = await openHistoryReplayDatabase();
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
  const database = await openHistoryReplayDatabase();
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
