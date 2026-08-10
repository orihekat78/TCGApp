import type { CausalLogEntryV1, GameState } from '@/engine/types';
import { validateCausalLog, validateGameCausalState } from '@/engine/log/causal';
import { projectPublicCausalLogEntry } from '@/ui/services/replayViewerProjection';
import { PresentationQueue } from './PresentationQueue';

const queue = new PresentationQueue();
const UNOWNED_PRESENTATION_SESSION_ID = 'presentation-unowned';
let generatedSession = 0;
let activeSessionId: string | null = null;
let admittedSequence = 0;
let latestCommittedSequence = 0;

export function getPresentationQueue(): PresentationQueue {
  return queue;
}

export function resetPresentationQueue(sessionId = nextSessionId('presentation-reset')): number {
  activeSessionId = sessionId;
  admittedSequence = 0;
  latestCommittedSequence = 0;
  return queue.startSession(sessionId);
}

export type LivePresentationAdmission = {
  admitted: number;
  rejected: 'capacity' | 'session' | null;
};

/** Admit causal events added since the last committed GameState, exactly once. */
export function admitPresentationFromState(state: GameState): LivePresentationAdmission {
  const raw = validateGameCausalState(state);
  const sessionId = state.causalLog?.sessionId ?? raw[0]?.sessionId;
  if (sessionId !== undefined && (activeSessionId === null || sessionId !== activeSessionId)) {
    return { admitted: 0, rejected: 'session' };
  }
  if (raw.length === 0) return { admitted: 0, rejected: null };
  const ordered = validateCausalLog(raw.map((entry) => projectPublicCausalLogEntry(state, entry)));
  latestCommittedSequence = ordered.at(-1)!.sequence;
  if (admittedSequence > ordered.length) {
    throw new Error('Live presentation graph moved backwards without a session reset');
  }

  let admitted = 0;
  for (const event of ordered) {
    if (event.sequence <= admittedSequence) continue;
    const result = queue.enqueue(event, ordered);
    if (!result.accepted) return { admitted, rejected: result.reason };
    admittedSequence = event.sequence;
    admitted += 1;
  }
  return { admitted, rejected: null };
}

/** Consume the committed suffix when the user skips, without dispatching engine work. */
export function skipCommittedPresentationSuffix(): number {
  const skipped = Math.max(0, latestCommittedSequence - admittedSequence);
  admittedSequence = latestCommittedSequence;
  return skipped;
}

export function currentPresentationSessionId(): string {
  return activeSessionId ?? UNOWNED_PRESENTATION_SESSION_ID;
}

/** Pure preflight used before a replay is allowed to replace live runtime ownership. */
export function validatePresentationAtCurrentState(state: GameState): void {
  presentationPosition(state);
}

/** Replay load/seek positions presentation after the reconstructed state. Past work is never replayed. */
export function rebuildPresentationAtCurrentState(state: GameState): number {
  const position = presentationPosition(state);
  if (position.type === 'legacy') return resetPresentationQueue(nextSessionId('legacy-replay'));
  const { ordered, sessionId, currentSequence } = position;
  activeSessionId = sessionId;
  admittedSequence = currentSequence - 1;
  latestCommittedSequence = ordered.at(-1)?.sequence ?? 0;
  return queue.rebuildFrom(sessionId, ordered, currentSequence);
}

type PresentationPosition =
  | { type: 'legacy' }
  | {
    type: 'causal';
    ordered: CausalLogEntryV1[];
    sessionId: string;
    currentSequence: number;
  };

function presentationPosition(state: GameState): PresentationPosition {
  const raw = validateGameCausalState(state);
  if (raw.length === 0) {
    if (state.causalLog === undefined) return { type: 'legacy' };
    return {
      type: 'causal',
      ordered: [],
      sessionId: state.causalLog.sessionId,
      currentSequence: state.causalLog.nextSequence,
    };
  }
  const ordered = validateCausalLog(raw.map((entry) => projectPublicCausalLogEntry(state, entry)));
  return {
    type: 'causal',
    ordered,
    sessionId: ordered[0].sessionId,
    currentSequence: ordered.at(-1)!.sequence + 1,
  };
}

function nextSessionId(prefix: string): string {
  generatedSession += 1;
  return `${prefix}:${generatedSession}`;
}
