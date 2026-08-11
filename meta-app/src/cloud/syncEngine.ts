import type { DeckRecord, MatchRecord } from '../data/types';
import { CloudApiError, type CloudApiClient } from './apiClient';
import {
  createCloudOperationIdentity,
  planInitialCloudMigration,
} from './migration';
import { projectDeckForCloud, projectMatchForCloud, stableCloudResourceId } from './projection';
import { planCloudReconciliation } from './reconciliation';
import {
  MAX_CLOUD_OUTBOX_OPERATIONS,
  CloudSyncOwnerMismatchError,
  bindCloudSyncOwner,
  enqueueCloudSyncOperations,
  readCloudSyncState,
  updateCloudSyncState,
} from './storage';
import type {
  CloudOperationIdentity,
  CloudOperationResult,
  CloudSyncConflict,
  CloudSyncOperation,
  CloudSyncStatus,
} from './types';

const MAX_REQUESTS_PER_DRAIN = 4;
const CLIENT_REQUEST_WINDOW_MS = 60_000;
const DEFAULT_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;
const CONFLICT_RETRY_MS = 24 * 60 * 60_000;

export interface LocalCloudDataPort {
  snapshot(): {
    decks: DeckRecord[];
    activeDeckId: string;
    history: MatchRecord[];
  };
  mergeRemoteDecks(decks: readonly DeckRecord[], activeDeckToAdopt: string | null): void;
}

type EngineOptions = {
  api: CloudApiClient;
  local: LocalCloudDataPort;
  appVersion: string;
  now?: () => number;
  createIdentity?: () => CloudOperationIdentity;
  onStatus?: (status: CloudSyncStatus) => void;
};

export interface CloudSyncEngine {
  initialize(): Promise<void>;
  stop(): void;
  drain(options?: { forceRetry?: boolean }): Promise<void>;
  journalDeckDelete(localDeckId: string): Promise<void>;
  enqueueDeck(deck: DeckRecord): Promise<void>;
  enqueueDeckDelete(localDeckId: string): Promise<void>;
  enqueueActiveDeck(localDeckId: string | null): Promise<void>;
  enqueueMatch(match: MatchRecord): Promise<void>;
}

function conflictFor(operation: CloudSyncOperation, code: string, now: number): CloudSyncConflict {
  switch (operation.kind) {
    case 'deck-put':
    case 'deck-delete':
      return { kind: 'deck', resourceId: operation.localDeckId, detectedAt: now, code };
    case 'active-deck-put':
      return { kind: 'active-deck', resourceId: operation.localDeckId ?? 'none', detectedAt: now, code };
    case 'match-post':
      return { kind: 'deck', resourceId: operation.localDeckId, detectedAt: now, code: `MATCH_${code}` };
  }
}

function retryDelay(operation: CloudSyncOperation, error: CloudApiError | null): number {
  if (error?.retryAfterMs !== null && error?.retryAfterMs !== undefined) {
    return Math.min(MAX_RETRY_MS, Math.max(1_000, error.retryAfterMs));
  }
  return Math.min(MAX_RETRY_MS, DEFAULT_RETRY_MS * (2 ** Math.min(6, operation.attempts)));
}

class CloudSyncEngineImpl implements CloudSyncEngine {
  private readonly now: () => number;
  private readonly createIdentity: () => CloudOperationIdentity;
  private activeInitialize: Promise<void> | null = null;
  private activeDrain: Promise<void> | null = null;
  private email: string | null = null;
  private lastSyncedAt: number | null = null;
  private authorized = false;
  private ownerBlocked = false;
  private requestTimestamps: number[] = [];
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeAt: number | null = null;
  private stopped = false;

  constructor(private readonly options: EngineOptions) {
    this.now = options.now ?? Date.now;
    this.createIdentity = options.createIdentity ?? createCloudOperationIdentity;
  }

  private status(
    phase: CloudSyncStatus['phase'],
    pendingCount: number,
    message: string | null = null,
  ): void {
    this.options.onStatus?.({
      phase,
      email: this.email,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      message,
    });
  }

  initialize(): Promise<void> {
    if (this.activeInitialize) return this.activeInitialize;
    this.activeInitialize = this.runInitialize().finally(() => {
      this.activeInitialize = null;
    });
    return this.activeInitialize;
  }

  private async runInitialize(): Promise<void> {
    if (this.stopped) return;
    if (this.ownerBlocked) {
      this.status('conflict', 0, 'CLOUD_SYNC_OWNER_MISMATCH');
      return;
    }
    this.status('syncing', 0);
    let bootstrap;
    try {
      bootstrap = await this.options.api.bootstrap();
      await bindCloudSyncOwner(bootstrap.identity.email, this.now());
      this.email = bootstrap.identity.email.trim().toLowerCase();
      this.authorized = true;
    } catch (error) {
      this.authorized = false;
      if (error instanceof CloudSyncOwnerMismatchError) {
        this.ownerBlocked = true;
        this.status('conflict', 0, 'CLOUD_SYNC_OWNER_MISMATCH');
        return;
      }
      const apiError = error instanceof CloudApiError ? error : null;
      this.status(apiError?.offline ? 'offline' : 'error', 0, apiError?.code ?? 'SYNC_INITIALIZATION_FAILED');
      return;
    }

    const state = await readCloudSyncState();
    if (state.initialImportCompletedAt === null) {
      const local = this.options.local.snapshot();
      const plan = await planInitialCloudMigration({
        ...local,
        bootstrap,
        appVersion: this.options.appVersion,
        now: this.now(),
        createIdentity: this.createIdentity,
      });
      this.options.local.mergeRemoteDecks(plan.remoteDecksToAdd, plan.activeDeckToAdopt);
      await updateCloudSyncState((current) => {
        if (current.initialImportCompletedAt !== null) return;
        if (current.outbox.length + plan.operations.length > MAX_CLOUD_OUTBOX_OPERATIONS) {
          throw new Error('CLOUD_SYNC_OUTBOX_FULL');
        }
        current.outbox.push(...structuredClone(plan.operations));
        current.deckMetadata = {
          ...current.deckMetadata,
          ...structuredClone(plan.deckMetadata),
        };
        current.activeDeckRevision = plan.activeDeckRevision;
        current.conflicts.push(...structuredClone(plan.conflicts));
        current.initialImportCompletedAt = this.now();
      });
    } else {
      const local = this.options.local.snapshot();
      const plan = await planCloudReconciliation({
        decks: local.decks,
        activeDeckId: local.activeDeckId,
        history: local.history,
        bootstrap,
        state,
        appVersion: this.options.appVersion,
        now: this.now(),
        createIdentity: this.createIdentity,
      });
      this.options.local.mergeRemoteDecks(plan.remoteDecksToApply, plan.activeDeckToAdopt);
      await updateCloudSyncState((current) => {
        if (current.outbox.length + plan.operations.length > MAX_CLOUD_OUTBOX_OPERATIONS) {
          throw new Error('CLOUD_SYNC_OUTBOX_FULL');
        }
        current.outbox.push(...structuredClone(plan.operations));
        current.deckMetadata = structuredClone(plan.deckMetadata);
        current.activeDeckRevision = plan.activeDeckRevision;
        current.conflicts.push(...structuredClone(plan.conflicts));
      });
    }
    await this.enqueuePersistedDeckDeletes();
    await this.drain();
  }

  stop(): void {
    this.stopped = true;
    this.clearWakeTimer();
  }

  drain(options: { forceRetry?: boolean } = {}): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.ownerBlocked) return Promise.resolve();
    if (!this.authorized) return this.initialize();
    if (this.activeDrain) return this.activeDrain;
    this.clearWakeTimer();
    this.activeDrain = this.runDrain(options).finally(() => {
      this.activeDrain = null;
    });
    return this.activeDrain;
  }

  private async runDrain(options: { forceRetry?: boolean }): Promise<void> {
    let requestCount = 0;
    while (requestCount < MAX_REQUESTS_PER_DRAIN) {
      const state = await readCloudSyncState();
      const next = state.outbox[0];
      if (!next) {
        this.clearWakeTimer();
        this.lastSyncedAt = this.now();
        this.status(state.conflicts.length ? 'conflict' : 'online', 0);
        return;
      }
      if (!options.forceRetry && next.nextAttemptAt > this.now()) {
        this.scheduleWake(next.nextAttemptAt);
        this.status(next.attempts > 0 ? 'offline' : 'idle', state.outbox.length);
        return;
      }
      const windowStart = this.now() - CLIENT_REQUEST_WINDOW_MS;
      this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp > windowStart);
      if (this.requestTimestamps.length >= MAX_REQUESTS_PER_DRAIN) {
        this.scheduleWake(Math.min(...this.requestTimestamps) + CLIENT_REQUEST_WINDOW_MS);
        this.status('idle', state.outbox.length, 'MINUTE_BUDGET_PAUSE');
        return;
      }
      const prepared = await this.prepareAttempt(next.operationId);
      if (!prepared) {
        this.status('idle', state.outbox.length, 'WAITING_FOR_DECK_REVISION');
        return;
      }
      this.status('syncing', state.outbox.length);
      requestCount += 1;
      this.requestTimestamps.push(this.now());
      try {
        const result = await this.options.api.execute(prepared);
        await this.complete(prepared, result);
        this.lastSyncedAt = this.now();
      } catch (error) {
        const nextAttemptAt = await this.fail(prepared, error);
        if (nextAttemptAt !== null) this.scheduleWake(nextAttemptAt);
        return;
      }
      options = { forceRetry: false };
    }
    const remaining = (await readCloudSyncState()).outbox.length;
    if (remaining) {
      this.scheduleWake(Math.min(...this.requestTimestamps) + CLIENT_REQUEST_WINDOW_MS);
    }
    this.status('idle', remaining, remaining ? 'MINUTE_BUDGET_PAUSE' : null);
  }

  private clearWakeTimer(): void {
    if (this.wakeTimer !== null) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    this.wakeAt = null;
  }

  private scheduleWake(requestedAt: number): void {
    if (this.stopped) return;
    const wakeAt = Math.max(this.now(), requestedAt);
    if (this.wakeTimer !== null && this.wakeAt !== null && this.wakeAt <= wakeAt) return;
    this.clearWakeTimer();
    this.wakeAt = wakeAt;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.wakeAt = null;
      void this.drain().catch(() => {
        this.status('error', 0, 'SYNC_WAKE_FAILED');
      });
    }, Math.max(0, wakeAt - this.now()));
  }

  private async prepareAttempt(operationId: string): Promise<CloudSyncOperation | null> {
    let ready = true;
    const state = await updateCloudSyncState((current) => {
      const operation = current.outbox.find((candidate) => candidate.operationId === operationId);
      if (!operation) {
        ready = false;
        return;
      }
      if (operation.attempts === 0) {
        if (operation.kind === 'deck-put') {
          const revision = current.deckMetadata[operation.localDeckId]?.revision;
          if (revision !== undefined) operation.payload.expectedRevision = revision;
        } else if (operation.kind === 'deck-delete') {
          const revision = current.deckMetadata[operation.localDeckId]?.revision;
          if (revision !== undefined) operation.payload.expectedRevision = revision;
          if (operation.payload.expectedRevision === null) ready = false;
        } else if (operation.kind === 'active-deck-put') {
          if (current.activeDeckRevision !== null) {
            operation.payload.expectedRevision = current.activeDeckRevision;
          }
        } else if (operation.payload.deckRevision === null) {
          const revision = current.deckMetadata[operation.localDeckId]?.revision;
          if (revision === undefined) ready = false;
          else operation.payload.deckRevision = revision;
        }
      }
      if (!ready) return;
      operation.attempts += 1;
      operation.nextAttemptAt = this.now() + 30_000;
    });
    if (!ready) return null;
    return state.outbox.find((operation) => operation.operationId === operationId) ?? null;
  }

  private async complete(operation: CloudSyncOperation, result: CloudOperationResult): Promise<void> {
    await updateCloudSyncState((state) => {
      state.outbox = state.outbox.filter((candidate) => candidate.operationId !== operation.operationId);
      switch (operation.kind) {
        case 'deck-put': {
          if (result.kind !== 'deck-put') throw new Error('CLOUD_SYNC_RESULT_KIND_MISMATCH');
          state.deckMetadata[operation.localDeckId] = {
            cloudDeckId: result.deck.deckId,
            revision: result.deck.revision,
            lastSyncedModified: result.deck.clientModifiedAt,
            serverUpdatedAt: result.deck.serverUpdatedAt,
          };
          for (const pending of state.outbox) {
            if (
              pending.kind === 'match-post'
              && pending.localDeckId === operation.localDeckId
              && pending.attempts === 0
              && pending.payload.deckRevision === null
            ) pending.payload.deckRevision = result.deck.revision;
          }
          break;
        }
        case 'deck-delete':
          if (result.kind !== 'deck-delete') throw new Error('CLOUD_SYNC_RESULT_KIND_MISMATCH');
          delete state.deckMetadata[operation.localDeckId];
          delete state.deckDeleteIntents[operation.localDeckId];
          break;
        case 'active-deck-put':
          if (result.kind !== 'active-deck-put') throw new Error('CLOUD_SYNC_RESULT_KIND_MISMATCH');
          state.activeDeckRevision = result.activeDeck.revision;
          break;
        case 'match-post':
          if (result.kind !== 'match-post') throw new Error('CLOUD_SYNC_RESULT_KIND_MISMATCH');
          state.uploadedMatchIds[operation.localMatchId] = this.now();
          break;
      }
    });
  }

  private async fail(operation: CloudSyncOperation, error: unknown): Promise<number | null> {
    const apiError = error instanceof CloudApiError ? error : null;
    const now = this.now();
    const state = await updateCloudSyncState((current) => {
      const pending = current.outbox.find((candidate) => candidate.operationId === operation.operationId);
      if (!pending) return;
      if (apiError?.conflict) {
        pending.nextAttemptAt = now + CONFLICT_RETRY_MS;
        const conflict = conflictFor(pending, apiError.code, now);
        if (!current.conflicts.some((item) => (
          item.kind === conflict.kind
          && item.resourceId === conflict.resourceId
          && item.code === conflict.code
        ))) current.conflicts.push(conflict);
      } else {
        pending.nextAttemptAt = now + retryDelay(pending, apiError);
      }
    });
    if (apiError?.conflict) this.status('conflict', state.outbox.length, apiError.code);
    else if (apiError?.offline) this.status('offline', state.outbox.length, apiError.code);
    else this.status('error', state.outbox.length, apiError?.code ?? 'SYNC_FAILED');
    return state.outbox.find((candidate) => candidate.operationId === operation.operationId)?.nextAttemptAt ?? null;
  }

  async enqueueDeck(deck: DeckRecord): Promise<void> {
    if (this.ownerBlocked) return;
    await updateCloudSyncState((state) => {
      delete state.deckDeleteIntents[deck.id];
    });
    if (!this.authorized) return;
    const state = await readCloudSyncState();
    const projected = await projectDeckForCloud(deck, state.deckMetadata[deck.id]?.revision ?? null);
    if (!projected.ok) return;
    await enqueueCloudSyncOperations([{
      ...this.operationBase(),
      kind: 'deck-put',
      localDeckId: deck.id,
      payload: projected.payload,
    }]);
    await this.drain();
  }

  async journalDeckDelete(localDeckId: string): Promise<void> {
    if (!this.authorized && !this.ownerBlocked && !this.stopped) await this.initialize();
    if (this.stopped) throw new Error('CLOUD_SYNC_STOPPED');
    if (this.ownerBlocked) throw new CloudSyncOwnerMismatchError();
    if (!this.authorized) throw new Error('CLOUD_SYNC_OWNER_NOT_VERIFIED');
    const state = await readCloudSyncState();
    const pendingCreate = state.outbox.some((operation) => (
      operation.kind === 'deck-put' && operation.localDeckId === localDeckId
    ));
    const metadata = state.deckMetadata[localDeckId];
    const existingIntent = state.deckDeleteIntents[localDeckId];
    if (!metadata && !pendingCreate && !existingIntent) return;
    const cloudDeckId = metadata?.cloudDeckId
      ?? existingIntent?.cloudDeckId
      ?? await stableCloudResourceId('deck', localDeckId);
    await updateCloudSyncState((current) => {
      current.deckDeleteIntents[localDeckId] = {
        cloudDeckId,
        expectedRevision: metadata?.revision ?? existingIntent?.expectedRevision ?? null,
        deletedAt: existingIntent?.deletedAt ?? this.now(),
      };
    });
  }

  async enqueueDeckDelete(localDeckId: string): Promise<void> {
    await this.journalDeckDelete(localDeckId);
    if (this.ownerBlocked) return;
    if (!this.authorized) return;
    await this.enqueuePersistedDeckDeletes();
    await this.drain();
  }

  private async enqueuePersistedDeckDeletes(): Promise<void> {
    const state = await readCloudSyncState();
    const localDeckIds = new Set(this.options.local.snapshot().decks.map((deck) => deck.id));
    const pendingDeleteIds = new Set(state.outbox.flatMap((operation) => (
      operation.kind === 'deck-delete' ? [operation.localDeckId] : []
    )));
    const operations: CloudSyncOperation[] = [];
    for (const [localDeckId, intent] of Object.entries(state.deckDeleteIntents)) {
      if (localDeckIds.has(localDeckId) || pendingDeleteIds.has(localDeckId)) continue;
      const metadata = state.deckMetadata[localDeckId];
      const pendingCreate = state.outbox.some((operation) => (
        operation.kind === 'deck-put' && operation.localDeckId === localDeckId
      ));
      const expectedRevision = metadata?.revision ?? intent.expectedRevision;
      if (expectedRevision === null && !pendingCreate) continue;
      operations.push({
        ...this.operationBase(),
        kind: 'deck-delete',
        localDeckId,
        cloudDeckId: metadata?.cloudDeckId ?? intent.cloudDeckId,
        payload: { expectedRevision },
      });
    }
    if (operations.length) await enqueueCloudSyncOperations(operations);
  }

  async enqueueActiveDeck(localDeckId: string | null): Promise<void> {
    if (!this.authorized || this.ownerBlocked) return;
    const state = await readCloudSyncState();
    const activeDeckId = localDeckId === null
      ? null
      : state.deckMetadata[localDeckId]?.cloudDeckId
        ?? await stableCloudResourceId('deck', localDeckId);
    await enqueueCloudSyncOperations([{
      ...this.operationBase(),
      kind: 'active-deck-put',
      localDeckId,
      payload: { activeDeckId, expectedRevision: state.activeDeckRevision },
    }]);
    await this.drain();
  }

  async enqueueMatch(match: MatchRecord): Promise<void> {
    if (!this.authorized || this.ownerBlocked) return;
    const state = await readCloudSyncState();
    const localMatchId = match.sessionId ?? match.id;
    if (
      state.uploadedMatchIds[localMatchId] !== undefined
      || state.outbox.some((operation) => operation.kind === 'match-post' && operation.localMatchId === localMatchId)
    ) return;
    const localDeckId = match.selfDeckSnapshot?.deckId;
    const projected = await projectMatchForCloud(match, {
      deckRevision: localDeckId ? (state.deckMetadata[localDeckId]?.revision ?? null) : null,
      appVersion: this.options.appVersion,
      now: this.now(),
    });
    if (!projected.ok) return;
    await enqueueCloudSyncOperations([{
      ...this.operationBase(),
      kind: 'match-post',
      localMatchId,
      localDeckId: projected.localDeckId,
      payload: projected.payload,
    }]);
    await this.drain();
  }

  private operationBase(): CloudOperationIdentity & Pick<CloudSyncOperation, 'createdAt' | 'attempts' | 'nextAttemptAt'> {
    return {
      ...this.createIdentity(),
      createdAt: this.now(),
      attempts: 0,
      nextAttemptAt: this.now(),
    };
  }
}

export function createCloudSyncEngine(options: EngineOptions): CloudSyncEngine {
  return new CloudSyncEngineImpl(options);
}
