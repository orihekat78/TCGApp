type RollbackParticipant = {
  checkpoint: () => unknown;
  isCurrent: (checkpoint: unknown) => boolean;
  rollback: (checkpoint: unknown) => void;
};

const rollbackParticipants = new Set<RollbackParticipant>();
const rollbackPublicationSnapshots: unknown[] = [];

export class StoreRollbackHandledError extends Error {
  readonly original: unknown;

  constructor(original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = 'StoreRollbackHandledError';
    this.original = original;
  }
}

export function markStoreRollbackHandled(error: unknown): StoreRollbackHandledError {
  return error instanceof StoreRollbackHandledError
    ? error
    : new StoreRollbackHandledError(error);
}

export function storeRollbackCause(error: unknown): unknown {
  return error instanceof StoreRollbackHandledError ? error.original : error;
}

/** Store-owned transaction seam. Participants must not import the Zustand store. */
export function registerStoreRollbackParticipant(participant: RollbackParticipant): () => void {
  rollbackParticipants.add(participant);
  return () => rollbackParticipants.delete(participant);
}

export function checkpointStoreRollbackParticipants(): readonly [RollbackParticipant, unknown][] {
  return [...rollbackParticipants].map((participant) => [participant, participant.checkpoint()]);
}

export function areStoreRollbackParticipantsCurrent(
  checkpoints: readonly (readonly [RollbackParticipant, unknown])[],
): boolean {
  return checkpoints.every(([participant, checkpoint]) => participant.isCurrent(checkpoint));
}

/** Best effort only: preserve the causal error that triggered store rollback. */
export function rollbackStoreRollbackParticipants(
  checkpoints: readonly (readonly [RollbackParticipant, unknown])[],
): boolean {
  if (!areStoreRollbackParticipantsCurrent(checkpoints)) {
    return false;
  }
  for (const [participant, checkpoint] of checkpoints) {
    try {
      participant.rollback(checkpoint);
    } catch {
      return false;
    }
  }
  return true;
}

/** Mark the exact Zustand snapshot restored by a synchronous rollback. */
export function runStoreRollbackPublication<T>(snapshot: unknown, publish: () => T): T {
  rollbackPublicationSnapshots.push(snapshot);
  try {
    return publish();
  } finally {
    rollbackPublicationSnapshots.pop();
  }
}

/** Ignore only the restored snapshot, never a legitimate nested publication. */
export function isStoreRollbackPublication(snapshot: unknown): boolean {
  return rollbackPublicationSnapshots.includes(snapshot);
}
