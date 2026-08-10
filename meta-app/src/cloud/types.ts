export type CloudDeckPutPayload = {
  deckId: string;
  name: string;
  partnerCardNum: string;
  caseCardNum: string;
  cards: Array<{ cardNum: string; count: number }>;
  clientModifiedAt: number;
  expectedRevision: number | null;
};

export type CloudMatchPayload = {
  matchId: string;
  playedAt: number;
  deckId: string;
  deckRevision: number;
  deckName: string;
  cpuRequestedDifficulty: 'weak' | 'normal' | 'strong';
  cpuEffectiveDifficulty: 'weak' | 'normal' | 'strong';
  cpuPolicyVersion: string;
  outcome: 'win' | 'loss';
  turnCount: number;
  appVersion: string;
};

export type CloudMatchDraft = Omit<CloudMatchPayload, 'deckRevision'> & {
  deckRevision: number | null;
};

export type CloudDeck = Omit<CloudDeckPutPayload, 'expectedRevision'> & {
  revision: number;
  serverUpdatedAt: number;
};

export type CloudBootstrap = {
  identity: { email: string };
  decks: CloudDeck[];
  deletedDecks: Array<{ deckId: string; deletedAt: number }>;
  activeDeck: {
    activeDeckId: string | null;
    revision: number;
    serverUpdatedAt: number;
  } | null;
  stats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number | null;
  };
};

export type CloudOperationIdentity = {
  operationId: string;
  idempotencyKey: string;
};

export type CloudOperationResult =
  | { kind: 'deck-put'; deck: CloudDeck; replayed: boolean }
  | { kind: 'deck-delete'; deckId: string; deletedAt: number; replayed: boolean }
  | {
      kind: 'active-deck-put';
      activeDeck: NonNullable<CloudBootstrap['activeDeck']>;
      replayed: boolean;
    }
  | { kind: 'match-post'; matchId: string; replayed: boolean };

type CloudSyncOperationBase = {
  operationId: string;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
};

export type CloudSyncOperation =
  | (CloudSyncOperationBase & {
      kind: 'deck-put';
      localDeckId: string;
      payload: CloudDeckPutPayload;
    })
  | (CloudSyncOperationBase & {
      kind: 'deck-delete';
      localDeckId: string;
      cloudDeckId: string;
      payload: { expectedRevision: number | null };
    })
  | (CloudSyncOperationBase & {
      kind: 'active-deck-put';
      localDeckId: string | null;
      payload: {
        activeDeckId: string | null;
        expectedRevision: number | null;
      };
    })
  | (CloudSyncOperationBase & {
      kind: 'match-post';
      localMatchId: string;
      localDeckId: string;
      payload: CloudMatchDraft;
    });

export type CloudDeckMetadata = {
  cloudDeckId: string;
  revision: number;
  lastSyncedModified: number;
  serverUpdatedAt: number;
};

export type CloudDeckDeleteIntent = {
  cloudDeckId: string;
  expectedRevision: number | null;
  deletedAt: number;
};

export type CloudSyncConflict = {
  kind: 'deck' | 'active-deck' | 'account';
  resourceId: string;
  detectedAt: number;
  code: string;
};

export type CloudSyncState = {
  schemaVersion: 1;
  ownerEmail: string | null;
  ownerBoundAt: number | null;
  initialImportCompletedAt: number | null;
  outbox: CloudSyncOperation[];
  deckMetadata: Record<string, CloudDeckMetadata>;
  deckDeleteIntents: Record<string, CloudDeckDeleteIntent>;
  activeDeckRevision: number | null;
  uploadedMatchIds: Record<string, number>;
  conflicts: CloudSyncConflict[];
};

export type CloudSyncPhase =
  | 'disabled'
  | 'idle'
  | 'syncing'
  | 'online'
  | 'offline'
  | 'conflict'
  | 'error';

export type CloudSyncStatus = {
  phase: CloudSyncPhase;
  email: string | null;
  pendingCount: number;
  lastSyncedAt: number | null;
  message: string | null;
};
