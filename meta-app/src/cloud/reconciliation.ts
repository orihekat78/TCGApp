import type { DeckRecord, MatchRecord } from '../data/types';
import {
  cloudDeckMatchesLocal,
  cloudDeckMetadata,
  cloudDeckToLocalRecord,
  createCloudOperationIdentity,
} from './migration';
import { projectDeckForCloud, projectMatchForCloud, stableCloudResourceId } from './projection';
import type {
  CloudBootstrap,
  CloudDeckMetadata,
  CloudOperationIdentity,
  CloudSyncConflict,
  CloudSyncOperation,
  CloudSyncState,
} from './types';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

export type CloudReconciliationPlan = {
  operations: CloudSyncOperation[];
  remoteDecksToApply: DeckRecord[];
  deckMetadata: Record<string, CloudDeckMetadata>;
  activeDeckRevision: number | null;
  activeDeckToAdopt: string | null;
  conflicts: CloudSyncConflict[];
};

type Options = {
  decks: readonly DeckRecord[];
  activeDeckId: string;
  history: readonly MatchRecord[];
  bootstrap: CloudBootstrap;
  state: CloudSyncState;
  appVersion: string;
  now: number;
  createIdentity?: () => CloudOperationIdentity;
};

function operationBase(
  now: number,
  createIdentity: () => CloudOperationIdentity,
): CloudOperationIdentity & Pick<CloudSyncOperation, 'createdAt' | 'attempts' | 'nextAttemptAt'> {
  const identity = createIdentity();
  if (!identity.operationId.trim() || !IDEMPOTENCY_KEY.test(identity.idempotencyKey)) {
    throw new Error('CLOUD_SYNC_OPERATION_IDENTITY_INVALID');
  }
  return { ...identity, createdAt: now, attempts: 0, nextAttemptAt: now };
}

function conflictKey(conflict: CloudSyncConflict): string {
  return `${conflict.kind}\u0000${conflict.resourceId}\u0000${conflict.code}`;
}

export async function planCloudReconciliation(options: Options): Promise<CloudReconciliationPlan> {
  const createIdentity = options.createIdentity ?? createCloudOperationIdentity;
  const operations: CloudSyncOperation[] = [];
  const remoteDecksToApply: DeckRecord[] = [];
  const metadata = structuredClone(options.state.deckMetadata);
  const conflicts: CloudSyncConflict[] = [];
  const knownConflicts = new Set(options.state.conflicts.map(conflictKey));
  const addConflict = (kind: CloudSyncConflict['kind'], resourceId: string, code: string) => {
    const conflict = { kind, resourceId, code, detectedAt: options.now } satisfies CloudSyncConflict;
    const key = conflictKey(conflict);
    if (!knownConflicts.has(key)) {
      knownConflicts.add(key);
      conflicts.push(conflict);
    }
  };

  const remoteById = new Map(options.bootstrap.decks.map((deck) => [deck.deckId, deck]));
  const tombstones = new Set(options.bootstrap.deletedDecks.map((deck) => deck.deckId));
  const consumedRemoteIds = new Set<string>();
  const pendingDeckIds = new Set(options.state.outbox.flatMap((operation) => (
    operation.kind === 'deck-put' || operation.kind === 'deck-delete'
      ? [operation.localDeckId]
      : []
  )));

  for (const local of options.decks) {
    const previous = metadata[local.id];
    const cloudDeckId = previous?.cloudDeckId ?? await stableCloudResourceId('deck', local.id);
    if (tombstones.has(cloudDeckId)) {
      addConflict('deck', local.id, 'DECK_REMOTE_DELETED');
      continue;
    }
    const remote = remoteById.get(cloudDeckId);
    if (!remote) {
      if (previous) addConflict('deck', local.id, 'DECK_REMOTE_MISSING');
      else if (!pendingDeckIds.has(local.id)) {
        const projected = await projectDeckForCloud(local, null);
        if (projected.ok) {
          operations.push({
            ...operationBase(options.now, createIdentity),
            kind: 'deck-put',
            localDeckId: local.id,
            payload: projected.payload,
          });
        }
      }
      continue;
    }
    consumedRemoteIds.add(remote.deckId);

    if (!previous) {
      if (cloudDeckMatchesLocal(local, remote)) {
        metadata[local.id] = cloudDeckMetadata(local, remote);
      } else {
        addConflict('deck', local.id, 'DECK_UNTRACKED_REMOTE_CONFLICT');
      }
      continue;
    }

    if (cloudDeckMatchesLocal(local, remote)) {
      metadata[local.id] = cloudDeckMetadata(local, remote);
      continue;
    }

    const localChanged = local.modified !== previous.lastSyncedModified;
    const remoteChanged = remote.revision !== previous.revision;
    const pending = pendingDeckIds.has(local.id);
    if (!localChanged && remoteChanged && !pending && remote.revision > previous.revision) {
      const replacement = cloudDeckToLocalRecord(remote, local.id);
      remoteDecksToApply.push(replacement);
      metadata[local.id] = cloudDeckMetadata(replacement, remote);
    } else if (localChanged && !remoteChanged && !pending) {
      const projected = await projectDeckForCloud(local, previous.revision);
      if (projected.ok) {
        operations.push({
          ...operationBase(options.now, createIdentity),
          kind: 'deck-put',
          localDeckId: local.id,
          payload: projected.payload,
        });
      }
    } else if (localChanged && remoteChanged) {
      addConflict('deck', local.id, 'DECK_BOTH_CHANGED');
    } else if (pending && remoteChanged) {
      addConflict('deck', local.id, 'DECK_REMOTE_CHANGED_WITH_PENDING_WRITE');
    } else {
      addConflict('deck', local.id, 'DECK_SYNC_INVARIANT');
    }
  }

  const knownCloudIds = new Set(Object.values(metadata).map((item) => item.cloudDeckId));
  for (const remote of options.bootstrap.decks) {
    if (consumedRemoteIds.has(remote.deckId) || knownCloudIds.has(remote.deckId)) continue;
    const imported = cloudDeckToLocalRecord(remote);
    remoteDecksToApply.push(imported);
    metadata[imported.id] = cloudDeckMetadata(imported, remote);
    knownCloudIds.add(remote.deckId);
  }

  let activeDeckRevision = options.state.activeDeckRevision;
  let activeDeckToAdopt: string | null = null;
  const remoteActive = options.bootstrap.activeDeck;
  const activeCloudId = options.activeDeckId
    ? metadata[options.activeDeckId]?.cloudDeckId
      ?? await stableCloudResourceId('deck', options.activeDeckId)
    : null;
  const pendingActive = options.state.outbox.some((operation) => operation.kind === 'active-deck-put');
  const localIdForRemoteActive = remoteActive?.activeDeckId
    ? Object.entries(metadata).find(([localDeckId, item]) => (
        item.cloudDeckId === remoteActive.activeDeckId
        && options.state.deckDeleteIntents[localDeckId] === undefined
      ))?.[0] ?? null
    : null;

  if (remoteActive) {
    if (activeCloudId === remoteActive.activeDeckId) {
      activeDeckRevision = remoteActive.revision;
    } else if (!options.activeDeckId && localIdForRemoteActive) {
      activeDeckToAdopt = localIdForRemoteActive;
      activeDeckRevision = remoteActive.revision;
    } else if (activeDeckRevision !== null && remoteActive.revision !== activeDeckRevision) {
      addConflict('active-deck', options.activeDeckId || 'none', 'ACTIVE_DECK_REMOTE_CHANGED');
    } else if (!pendingActive) {
      operations.push({
        ...operationBase(options.now, createIdentity),
        kind: 'active-deck-put',
        localDeckId: options.activeDeckId || null,
        payload: { activeDeckId: activeCloudId, expectedRevision: activeDeckRevision },
      });
    }
  } else if (activeDeckRevision !== null) {
    addConflict('active-deck', options.activeDeckId || 'none', 'ACTIVE_DECK_REMOTE_MISSING');
  } else if (activeCloudId && !pendingActive) {
    operations.push({
      ...operationBase(options.now, createIdentity),
      kind: 'active-deck-put',
      localDeckId: options.activeDeckId,
      payload: { activeDeckId: activeCloudId, expectedRevision: null },
    });
  }

  const blockedDeckIds = new Set([
    ...options.state.conflicts,
    ...conflicts,
  ].flatMap((conflict) => conflict.kind === 'deck' ? [conflict.resourceId] : []));
  const pendingMatchIds = new Set(options.state.outbox.flatMap((operation) => (
    operation.kind === 'match-post' ? [operation.localMatchId] : []
  )));
  const deckWrites = new Set([
    ...options.state.outbox,
    ...operations,
  ].flatMap((operation) => operation.kind === 'deck-put' ? [operation.localDeckId] : []));
  for (const match of options.history) {
    const localMatchId = match.sessionId ?? match.id;
    if (options.state.uploadedMatchIds[localMatchId] || pendingMatchIds.has(localMatchId)) continue;
    const localDeckId = match.selfDeckSnapshot?.deckId;
    if (!localDeckId || blockedDeckIds.has(localDeckId)) continue;
    const deck = metadata[localDeckId];
    const projected = await projectMatchForCloud(match, {
      deckRevision: deckWrites.has(localDeckId) ? null : deck?.revision ?? null,
      appVersion: options.appVersion,
      now: options.now,
    });
    if (!projected.ok) continue;
    const cloudDeckId = deck?.cloudDeckId ?? await stableCloudResourceId('deck', localDeckId);
    operations.push({
      ...operationBase(options.now, createIdentity),
      kind: 'match-post',
      localMatchId,
      localDeckId,
      payload: { ...projected.payload, deckId: cloudDeckId },
    });
    pendingMatchIds.add(localMatchId);
  }

  return {
    operations,
    remoteDecksToApply,
    deckMetadata: metadata,
    activeDeckRevision,
    activeDeckToAdopt,
    conflicts,
  };
}
