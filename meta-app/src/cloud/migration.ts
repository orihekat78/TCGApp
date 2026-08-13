import type { DeckRecord, MatchRecord } from '../data/types';
import { projectDeckForCloud, projectMatchForCloud } from './projection';
import type {
  CloudBootstrap,
  CloudDeck,
  CloudDeckMetadata,
  CloudOperationIdentity,
  CloudSyncConflict,
  CloudSyncOperation,
} from './types';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

export type InitialCloudMigrationPlan = {
  operations: CloudSyncOperation[];
  remoteDecksToAdd: DeckRecord[];
  deckMetadata: Record<string, CloudDeckMetadata>;
  activeDeckRevision: number | null;
  activeDeckToAdopt: string | null;
  conflicts: CloudSyncConflict[];
  skippedMatches: Array<{ localMatchId: string; reason: string }>;
};

type PlanOptions = {
  decks: readonly DeckRecord[];
  activeDeckId: string;
  history: readonly MatchRecord[];
  bootstrap: CloudBootstrap;
  appVersion: string;
  now: number;
  createIdentity?: () => CloudOperationIdentity;
};

export function createCloudOperationIdentity(): CloudOperationIdentity {
  const token = crypto.randomUUID().replaceAll('-', '');
  return {
    operationId: `op_${token}`,
    idempotencyKey: `idem_${token}`,
  };
}

function operationBase(
  now: number,
  createIdentity: () => CloudOperationIdentity,
): CloudOperationIdentity & Pick<CloudSyncOperation, 'createdAt' | 'attempts' | 'nextAttemptAt'> {
  const identity = createIdentity();
  if (!identity.operationId.trim() || !IDEMPOTENCY_KEY.test(identity.idempotencyKey)) {
    throw new Error('CLOUD_SYNC_OPERATION_IDENTITY_INVALID');
  }
  return {
    ...identity,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
  };
}

function canonicalCards(cards: Array<{ cardNum: string; count: number }>): string {
  return JSON.stringify([...cards].sort((left, right) => left.cardNum.localeCompare(right.cardNum)));
}

function duplicateDeckIds(decks: readonly DeckRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const deck of decks) {
    if (typeof deck?.id !== 'string') continue;
    counts.set(deck.id, (counts.get(deck.id) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([deckId]) => deckId),
  );
}

export function cloudDeckMatchesLocal(local: DeckRecord, remote: CloudDeck): boolean {
  return local.name === remote.name
    && local.partner === remote.partnerCardNum
    && local.case === remote.caseCardNum
    && canonicalCards(local.cards.map(({ num, count }) => ({ cardNum: num, count })))
      === canonicalCards(remote.cards);
}

export function cloudDeckToLocalRecord(remote: CloudDeck, localId = remote.deckId): DeckRecord {
  return {
    id: localId,
    name: remote.name,
    partner: remote.partnerCardNum,
    case: remote.caseCardNum,
    cards: remote.cards.map(({ cardNum, count }) => ({ num: cardNum, count })),
    modified: remote.clientModifiedAt,
  };
}

export function cloudDeckMetadata(
  local: DeckRecord,
  remote: CloudDeck,
): CloudDeckMetadata {
  return {
    cloudDeckId: remote.deckId,
    revision: remote.revision,
    lastSyncedModified: local.modified,
    serverUpdatedAt: remote.serverUpdatedAt,
  };
}

export async function planInitialCloudMigration(
  options: PlanOptions,
): Promise<InitialCloudMigrationPlan> {
  const createIdentity = options.createIdentity ?? createCloudOperationIdentity;
  const operations: CloudSyncOperation[] = [];
  const remoteDecksToAdd: DeckRecord[] = [];
  const metadata: Record<string, CloudDeckMetadata> = {};
  const conflicts: CloudSyncConflict[] = [];
  const skippedMatches: InitialCloudMigrationPlan['skippedMatches'] = [];
  const blockedDeckIds = new Set<string>();
  const remoteById = new Map(options.bootstrap.decks.map((deck) => [deck.deckId, deck]));
  const tombstones = new Map(options.bootstrap.deletedDecks.map((deck) => [deck.deckId, deck]));
  const consumedRemoteIds = new Set<string>();
  const cloudIdByLocalId = new Map<string, string>();
  const unplayableDeckIds = new Set<string>();
  const duplicateLocalDeckIds = duplicateDeckIds(options.decks);

  for (const local of options.decks) {
    if (duplicateLocalDeckIds.has(local.id)) {
      blockedDeckIds.add(local.id);
      unplayableDeckIds.add(local.id);
      continue;
    }
    const projected = await projectDeckForCloud(local, null);
    if (!projected.ok) {
      blockedDeckIds.add(local.id);
      unplayableDeckIds.add(local.id);
      continue;
    }
    const cloudId = projected.payload.deckId;
    cloudIdByLocalId.set(local.id, cloudId);
    const tombstone = tombstones.get(cloudId);
    if (tombstone) {
      blockedDeckIds.add(local.id);
      conflicts.push({
        kind: 'deck',
        resourceId: local.id,
        detectedAt: options.now,
        code: 'DECK_TOMBSTONED',
      });
      continue;
    }

    const remote = remoteById.get(cloudId);
    if (remote) {
      consumedRemoteIds.add(remote.deckId);
      metadata[local.id] = cloudDeckMetadata(local, remote);
      if (!cloudDeckMatchesLocal(local, remote)) {
        blockedDeckIds.add(local.id);
        conflicts.push({
          kind: 'deck',
          resourceId: local.id,
          detectedAt: options.now,
          code: 'DECK_CONTENT_CONFLICT',
        });
      }
      continue;
    }

    operations.push({
      ...operationBase(options.now, createIdentity),
      kind: 'deck-put',
      localDeckId: local.id,
      payload: projected.payload,
    });
  }

  for (const remote of options.bootstrap.decks) {
    if (consumedRemoteIds.has(remote.deckId)) continue;
    const imported = cloudDeckToLocalRecord(remote);
    remoteDecksToAdd.push(imported);
    metadata[imported.id] = cloudDeckMetadata(imported, remote);
    cloudIdByLocalId.set(imported.id, remote.deckId);
  }

  let activeDeckRevision: number | null = null;
  let activeDeckToAdopt: string | null = null;
  const localActiveCloudId = cloudIdByLocalId.get(options.activeDeckId) ?? null;
  if (options.bootstrap.activeDeck) {
    activeDeckRevision = options.bootstrap.activeDeck.revision;
    const remoteActiveId = options.bootstrap.activeDeck.activeDeckId;
    if (!options.activeDeckId && remoteActiveId) {
      activeDeckToAdopt = [...cloudIdByLocalId.entries()]
        .find(([, cloudId]) => cloudId === remoteActiveId)?.[0] ?? null;
    } else if (localActiveCloudId !== remoteActiveId) {
      conflicts.push({
        kind: 'active-deck',
        resourceId: options.activeDeckId || 'none',
        detectedAt: options.now,
        code: 'ACTIVE_DECK_CONFLICT',
      });
    }
  } else if (
    options.activeDeckId
    && localActiveCloudId
    && !blockedDeckIds.has(options.activeDeckId)
  ) {
    operations.push({
      ...operationBase(options.now, createIdentity),
      kind: 'active-deck-put',
      localDeckId: options.activeDeckId,
      payload: { activeDeckId: localActiveCloudId, expectedRevision: null },
    });
  }

  for (const match of options.history) {
    const localMatchId = match.sessionId ?? match.id;
    const localDeckId = match.selfDeckSnapshot?.deckId;
    if (localDeckId && unplayableDeckIds.has(localDeckId)) {
      skippedMatches.push({ localMatchId, reason: 'deck-not-playable' });
      continue;
    }
    if (localDeckId && blockedDeckIds.has(localDeckId)) {
      skippedMatches.push({ localMatchId, reason: 'deck-conflict' });
      continue;
    }
    const revision = localDeckId ? (metadata[localDeckId]?.revision ?? null) : null;
    const projected = await projectMatchForCloud(match, {
      deckRevision: revision,
      appVersion: options.appVersion,
      now: options.now,
    });
    if (!projected.ok) {
      skippedMatches.push({ localMatchId, reason: projected.reason });
      continue;
    }
    const knownCloudId = cloudIdByLocalId.get(projected.localDeckId);
    if (!knownCloudId) {
      skippedMatches.push({ localMatchId, reason: 'deck-not-synchronized' });
      continue;
    }
    operations.push({
      ...operationBase(options.now, createIdentity),
      kind: 'match-post',
      localMatchId,
      localDeckId: projected.localDeckId,
      payload: { ...projected.payload, deckId: knownCloudId },
    });
  }

  return {
    operations,
    remoteDecksToAdd,
    deckMetadata: metadata,
    activeDeckRevision,
    activeDeckToAdopt,
    conflicts,
    skippedMatches,
  };
}
