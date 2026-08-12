import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { buildReplayLogV3, type ReplayLogV3 } from '@/ai/replay/state-frame';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { FILE_CARD_BACK_PLACEHOLDER, type SceneCharacter } from '@/engine/types';
import { projectReplayLogForViewer } from '@/ui/services/replayViewerProjection';
import type { MatchRecord } from '../../meta-app/src/data/types';
import {
  MAX_REPLAY_ARTIFACT_BYTES,
  assertReplayArtifactByteLength,
  clearStoredHistoryReplays,
  listStoredHistoryRows,
  loadHistoryReplayArtifact,
  prepareHistoryReplayBundle,
  saveHistoryReplay,
  validateStoredReplayArtifact,
} from '../../meta-app/src/services/historyReplayRepository';

const DB_NAME = 'conan-history-replay-v1';
const ROW_STORE = 'historyRows';
const ARTIFACT_STORE = 'replayArtifacts';

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openRawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function replayFixture(
  sessionId = 'history-replay-a',
  viewerMode: 'solo-self' | 'spectator' = 'solo-self',
) {
  const initial = createEmptyGameState();
  initial.causalLog = { schemaVersion: 1, sessionId, nextSequence: 1 };
  initial.players.self.hand = ['D08001'];
  initial.players.opp.hand = ['D11001'];
  initial.players.self.deck = ['SELF-DECK-SECRET'];
  initial.players.opp.deck = ['OPP-DECK-SECRET'];
  initial.players.self.evidence = [{
    cardId: 'SELF-HIDDEN-EVIDENCE',
    faceUp: false,
    origin: { turn: 1, via: 'effect', sourceCardId: 'SELF-HIDDEN-SOURCE' },
  }];
  initial.players.self.file = [{ type: 'card-back', cardId: 'SELF-HIDDEN-FILE' }];
  initial.players.self.scene = [{
    cardId: 'PUBLIC-SCENE-CARD',
    uid: 'scene:self:history-private',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [{ cardId: 'SELF-HIDDEN-SET', faceUp: false, instanceId: 'set:hidden' }],
    stackedCards: [{ cardId: 'SELF-HIDDEN-STACK', instanceId: 'stack:hidden' }],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } satisfies SceneCharacter];
  const terminal = structuredClone(initial);
  terminal.turn.number = 3;
  mutate.gameResult.set(terminal, 'self', 'evidence');
  return buildReplayLogV3({
    artifactId: `replay-${sessionId}`,
    sessionId,
    viewerMode,
    states: [initial, terminal],
  });
}

function rowFixture(sessionId = 'history-replay-a'): MatchRecord {
  return {
    id: sessionId,
    sessionId,
    recorded: 1,
    won: true,
    deckName: 'self deck',
    oppDeckName: 'opp deck',
    mode: 'solo',
    turns: 3,
    duration: 0,
    evidGot: 7,
    evidLost: 0,
    contacts: 0,
    hirameki: 0,
    misread: 0,
    p1Target: 7,
    p2Target: 6,
  };
}

describe('history replay repository contract', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an opaque public row and a separately hashed exact artifact', async () => {
    const log = replayFixture();
    const bundle = await prepareHistoryReplayBundle(rowFixture(), log);

    expect(bundle.row.replayRef).toMatchObject({
      storageSchemaVersion: 1,
      replaySchemaVersion: 3,
      artifactId: log.artifactId,
    });
    expect(bundle.row.replayRef?.digest).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(JSON.stringify(bundle.row)).not.toContain('D08001');
    expect(JSON.stringify(bundle.row)).not.toContain('D11001');
    expect(validateStoredReplayArtifact(bundle.artifact, bundle.row))
      .toEqual(projectReplayLogForViewer(log));
  });

  it('rejects a different row, session, digest, or replay schema without fallback', async () => {
    const bundle = await prepareHistoryReplayBundle(rowFixture(), replayFixture());
    expect(() => validateStoredReplayArtifact(bundle.artifact, rowFixture('other-session'))).toThrow();
    expect(() => validateStoredReplayArtifact({ ...bundle.artifact, sessionId: 'other-session' }, bundle.row)).toThrow();
    expect(() => validateStoredReplayArtifact({ ...bundle.artifact, digest: `sha256-${'0'.repeat(64)}` }, bundle.row)).toThrow();
    expect(() => validateStoredReplayArtifact({
      ...bundle.artifact,
      log: { ...bundle.artifact.log, schemaVersion: 99 },
    }, bundle.row)).toThrow(/schema/i);
  });

  it('enforces history mode and replay viewer mode on save and load', async () => {
    await expect(prepareHistoryReplayBundle(
      rowFixture(),
      replayFixture('history-replay-a', 'spectator'),
    )).rejects.toThrow(/viewer mode/i);

    const observeRow = { ...rowFixture(), mode: 'observe' as const };
    await expect(prepareHistoryReplayBundle(observeRow, replayFixture()))
      .rejects.toThrow(/viewer mode/i);

    const missingMode = { ...rowFixture(), mode: undefined };
    await expect(prepareHistoryReplayBundle(missingMode, replayFixture()))
      .rejects.toThrow(/viewer mode/i);

    const bundle = await prepareHistoryReplayBundle(rowFixture(), replayFixture());
    expect(() => validateStoredReplayArtifact({
      ...bundle.artifact,
      log: { ...bundle.artifact.log, viewerMode: 'spectator' },
    }, bundle.row)).toThrow(/viewer mode/i);
  });

  it('accepts the exact artifact byte limit and rejects one byte more', () => {
    expect(() => assertReplayArtifactByteLength(MAX_REPLAY_ARTIFACT_BYTES)).not.toThrow();
    expect(() => assertReplayArtifactByteLength(MAX_REPLAY_ARTIFACT_BYTES + 1))
      .toThrow(/storage limit/i);
  });

  it('persists, lists, reloads, and clears an exact replay through IndexedDB', async () => {
    const log = replayFixture();
    const saved = await saveHistoryReplay(rowFixture(), log);

    expect((await listStoredHistoryRows())[0]).toEqual(saved);
    expect(await loadHistoryReplayArtifact(log.artifactId))
      .toEqual(projectReplayLogForViewer(log));

    await clearStoredHistoryReplays();
    expect(await listStoredHistoryRows()).toEqual([]);
    await expect(loadHistoryReplayArtifact(log.artifactId)).rejects.toThrow(/not found/i);
  });

  it('queues replay writes inside an IndexedDB request event for Safari', async () => {
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

    const log = replayFixture('history-replay-safari');
    await expect(saveHistoryReplay(rowFixture(log.sessionId), log)).resolves.toMatchObject({
      id: log.sessionId,
    });
    await expect(loadHistoryReplayArtifact(log.artifactId)).resolves
      .toEqual(projectReplayLogForViewer(log));
  });

  it.each([
    ['solo-self', 'solo', true],
    ['spectator', 'observe', false],
  ] as const)('projects private identities at the IndexedDB boundary for %s', async (
    viewerMode,
    historyMode,
    revealSelfHand,
  ) => {
    const sessionId = `history-private-${viewerMode}`;
    const rawLog = replayFixture(sessionId, viewerMode);
    await saveHistoryReplay({ ...rowFixture(sessionId), mode: historyMode }, rawLog);

    const stored = await loadHistoryReplayArtifact(rawLog.artifactId);
    const serialized = JSON.stringify(stored);
    expect(stored.initialState.players.self.hand).toEqual([
      revealSelfHand ? 'D08001' : FILE_CARD_BACK_PLACEHOLDER,
    ]);
    for (const secret of [
      'D11001', 'SELF-DECK-SECRET', 'OPP-DECK-SECRET',
      'SELF-HIDDEN-EVIDENCE', 'SELF-HIDDEN-SOURCE', 'SELF-HIDDEN-FILE',
      'SELF-HIDDEN-SET', 'SELF-HIDDEN-STACK',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized.includes('D08001')).toBe(revealSelfHand);
  });

  it('rolls back both stores when the artifact write fails after the history row write', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === ARTIFACT_STORE) {
        throw new DOMException('simulated artifact write failure', 'DataCloneError');
      }
      return key === undefined
        ? originalPut.call(this, value)
        : originalPut.call(this, value, key);
    });

    const log = replayFixture('history-replay-rollback');
    await expect(saveHistoryReplay(rowFixture(log.sessionId), log))
      .rejects.toThrow(/simulated artifact write failure/i);

    expect(await listStoredHistoryRows()).toEqual([]);
    await expect(loadHistoryReplayArtifact(log.artifactId)).rejects.toThrow(/not found/i);

    const database = await openRawDatabase();
    const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readonly');
    const [rowCount, artifactCount] = await Promise.all([
      requestValue(transaction.objectStore(ROW_STORE).count()),
      requestValue(transaction.objectStore(ARTIFACT_STORE).count()),
    ]);
    await transactionDone(transaction);
    database.close();
    expect(rowCount).toBe(0);
    expect(artifactCount).toBe(0);
  });

  it('rejects a replay artifact tampered inside the real artifact store', async () => {
    const log = replayFixture();
    await saveHistoryReplay(rowFixture(), log);
    const database = await openRawDatabase();
    const transaction = database.transaction(ARTIFACT_STORE, 'readwrite');
    const store = transaction.objectStore(ARTIFACT_STORE);
    const artifact = await requestValue(store.get(log.artifactId)) as Record<string, unknown>;
    const tamperedLog = structuredClone(artifact.log) as ReplayLogV3;
    tamperedLog.result.turns += 1;
    store.put({ ...artifact, log: tamperedLog });
    await transactionDone(transaction);
    database.close();

    await expect(loadHistoryReplayArtifact(log.artifactId)).rejects.toThrow();
  });

  it('rejects a stored history row that no longer owns the replay session', async () => {
    const log = replayFixture();
    const saved = await saveHistoryReplay(rowFixture(), log);
    const database = await openRawDatabase();
    const transaction = database.transaction(ROW_STORE, 'readwrite');
    transaction.objectStore(ROW_STORE).put({ ...saved, sessionId: 'different-session' });
    await transactionDone(transaction);
    database.close();

    await expect(loadHistoryReplayArtifact(log.artifactId)).rejects.toThrow(/session/i);
  });

  it('aborts both stores when an existing session is saved with different replay content', async () => {
    const original = replayFixture();
    await saveHistoryReplay(rowFixture(), original);
    const changedInitial = createEmptyGameState();
    changedInitial.causalLog = { schemaVersion: 1, sessionId: original.sessionId, nextSequence: 1 };
    changedInitial.turn.number = 2;
    const changedTerminal = structuredClone(changedInitial);
    changedTerminal.turn.number = 4;
    mutate.gameResult.set(changedTerminal, 'self', 'evidence');
    const conflicting = buildReplayLogV3({
      artifactId: original.artifactId,
      sessionId: original.sessionId,
      viewerMode: 'solo-self',
      states: [changedInitial, changedTerminal],
    });

    await expect(saveHistoryReplay(rowFixture(), conflicting)).rejects.toThrow(/different replay/i);
    expect(await loadHistoryReplayArtifact(original.artifactId))
      .toEqual(projectReplayLogForViewer(original));
    expect(await listStoredHistoryRows()).toHaveLength(1);
  });

  it('evicts the oldest history row and its paired artifact together at the 500-row cap', async () => {
    const oldestLog = replayFixture('history-replay-oldest');
    const oldest = await saveHistoryReplay({
      ...rowFixture('history-replay-oldest'),
      recorded: 0,
    }, oldestLog);
    const seededBundles = await Promise.all(Array.from({ length: 499 }, async (_entry, offset) => {
      const index = offset + 1;
      const sessionId = `seed-session-${index}`;
      return prepareHistoryReplayBundle({
        ...rowFixture(sessionId),
        recorded: index,
      }, replayFixture(sessionId));
    }));
    const database = await openRawDatabase();
    const transaction = database.transaction([ROW_STORE, ARTIFACT_STORE], 'readwrite');
    const rows = transaction.objectStore(ROW_STORE);
    const artifacts = transaction.objectStore(ARTIFACT_STORE);
    for (const bundle of seededBundles) {
      rows.put(bundle.row);
      artifacts.put(bundle.artifact);
    }
    await transactionDone(transaction);
    database.close();

    const newestLog = replayFixture('history-replay-newest');
    await saveHistoryReplay({
      ...rowFixture('history-replay-newest'),
      recorded: 1_000,
    }, newestLog);

    const verifyDatabase = await openRawDatabase();
    const verifyTransaction = verifyDatabase.transaction([ROW_STORE, ARTIFACT_STORE], 'readonly');
    const verifyRows = verifyTransaction.objectStore(ROW_STORE);
    const verifyArtifacts = verifyTransaction.objectStore(ARTIFACT_STORE);
    const [rowCount, artifactCount, expiredRow, expiredArtifact] = await Promise.all([
      requestValue(verifyRows.count()),
      requestValue(verifyArtifacts.count()),
      requestValue(verifyRows.get(oldest.id)),
      requestValue(verifyArtifacts.get(oldest.replayRef!.artifactId)),
    ]);
    await transactionDone(verifyTransaction);
    verifyDatabase.close();

    expect(rowCount).toBe(500);
    expect(artifactCount).toBe(500);
    expect(expiredRow).toBeUndefined();
    expect(expiredArtifact).toBeUndefined();
    expect(await loadHistoryReplayArtifact(newestLog.artifactId))
      .toEqual(projectReplayLogForViewer(newestLog));
    const survivingSeed = seededBundles.at(-1)!;
    expect(await loadHistoryReplayArtifact(survivingSeed.artifact.artifactId))
      .toEqual(survivingSeed.artifact.log);
  });
});
