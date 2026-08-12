import {
  buildReplayLogV3,
  canonicalReplayJson,
  type ReplayLogV3,
  type ReplayViewerMode,
} from '@/ai/replay/state-frame';
import { isCausalLogEntry } from '@/engine/log/causal';
import type { CausalLogEntryV1, GameState } from '@/engine/types';
import { isReplayOwnedState } from '@/ui/services/replayOwnership';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import {
  isStoreRollbackPublication,
  registerStoreRollbackParticipant,
} from '@/ui/services/storeTransaction';
import { useGameStateStore } from '@/ui/state/store';

type ActiveReplayRecording = {
  generation: number;
  sessionId: string;
  viewerMode: ReplayViewerMode;
  states: GameState[];
  rawCausalHistory: CausalLogEntryV1[];
  lastCapturedSourceState: GameState | null;
};

let activeRecording: ActiveReplayRecording | null = null;
let unsubscribe: (() => void) | null = null;
let recordingGeneration = 0;
const finalizedReplays = new Map<string, ReplayLogV3>();

export type LiveReplayRecordingCheckpoint = Readonly<{
  generation: number;
  sessionId: string;
  statesLength: number;
  rawCausalHistory: CausalLogEntryV1[];
  lastCapturedSourceState: GameState | null;
}> | null;

function stateBelongsToSession(state: GameState, sessionId: string): boolean {
  return state.causalLog?.schemaVersion === 1 && state.causalLog.sessionId === sessionId;
}

function captureCommittedState(state: GameState | null): void {
  const active = activeRecording;
  if (active === null || state === null || isReplayOwnedState(state)) return;
  if (state === active.lastCapturedSourceState) return;
  if (!stateBelongsToSession(state, active.sessionId)) return;
  const rawCausalHistory = state.log.filter(isCausalLogEntry);
  if (rawCausalHistory.length < active.rawCausalHistory.length) {
    throw new Error('Live replay causal history is not an immutable prefix');
  }
  for (let index = 0; index < active.rawCausalHistory.length; index += 1) {
    if (canonicalReplayJson(active.rawCausalHistory[index]) !== canonicalReplayJson(rawCausalHistory[index])) {
      throw new Error('Live replay causal history is not an immutable prefix');
    }
  }
  // Freeze the committed board/log state without carrying executable live
  // resolver continuations into the read-only Replay artifact.
  active.states.push(projectReplayStateForViewer(state, active.viewerMode, active.states.at(-1)));
  active.rawCausalHistory = structuredClone(rawCausalHistory);
  active.lastCapturedSourceState = state;
}

function ensureSubscription(): void {
  if (unsubscribe !== null) return;
  unsubscribe = useGameStateStore.subscribe((current, previous) => {
    if (current.gameState === previous.gameState) return;
    if (isStoreRollbackPublication(current)) return;
    captureCommittedState(current.gameState);
  });
}

export function startLiveReplayRecording(input: {
  sessionId: string;
  viewerMode: ReplayViewerMode;
}): void {
  if (!input.sessionId.trim()) throw new Error('Invalid replay session ID');
  if (input.viewerMode !== 'solo-self' && input.viewerMode !== 'spectator') {
    throw new Error('Invalid replay viewer mode');
  }
  ensureSubscription();
  finalizedReplays.delete(input.sessionId);
  activeRecording = {
    ...input,
    generation: ++recordingGeneration,
    states: [],
    rawCausalHistory: [],
    lastCapturedSourceState: null,
  };
  captureCommittedState(useGameStateStore.getState().gameState);
}

/** Opaque transaction point for a store commit that may synchronously roll back. */
export function checkpointLiveReplayRecording(): LiveReplayRecordingCheckpoint {
  const active = activeRecording;
  return active === null
    ? null
    : {
        generation: active.generation,
        sessionId: active.sessionId,
        statesLength: active.states.length,
        rawCausalHistory: structuredClone(active.rawCausalHistory),
        lastCapturedSourceState: active.lastCapturedSourceState,
      };
}

/** Restore recorder-owned speculative captures only while the same authority is active. */
export function rollbackLiveReplayRecording(
  checkpoint: LiveReplayRecordingCheckpoint,
): boolean {
  if (!isLiveReplayRecordingCheckpointCurrent(checkpoint)) return false;
  if (checkpoint === null) return true;
  const active = activeRecording!;
  active.states.length = checkpoint.statesLength;
  active.rawCausalHistory = structuredClone(checkpoint.rawCausalHistory);
  active.lastCapturedSourceState = checkpoint.lastCapturedSourceState;
  return true;
}

export function isLiveReplayRecordingCheckpointCurrent(
  checkpoint: LiveReplayRecordingCheckpoint,
): boolean {
  if (checkpoint === null) return activeRecording === null;
  const active = activeRecording;
  return active !== null
    && active.generation === checkpoint.generation
    && active.sessionId === checkpoint.sessionId
    && active.states.length >= checkpoint.statesLength;
}

export function finalizeLiveReplayRecording(sessionId: string): boolean {
  const active = activeRecording;
  if (active === null || active.sessionId !== sessionId) return false;
  const terminal = active.states.at(-1);
  if (terminal?.gameResult === null || terminal?.gameResult === undefined) return false;
  const artifactId = `replay-${sessionId}`;
  const log = buildReplayLogV3({
    artifactId,
    sessionId,
    viewerMode: active.viewerMode,
    states: active.states,
  });
  finalizedReplays.set(sessionId, log);
  activeRecording = null;
  return true;
}

export function getFinalizedReplay(sessionId: string): ReplayLogV3 | null {
  const replay = finalizedReplays.get(sessionId);
  return replay ? structuredClone(replay) : null;
}

export function discardLiveReplayRecording(sessionId?: string): void {
  if (sessionId === undefined || activeRecording?.sessionId === sessionId) activeRecording = null;
  if (sessionId === undefined) finalizedReplays.clear();
  else finalizedReplays.delete(sessionId);
}

export function resetLiveReplayRecorderForTests(): void {
  activeRecording = null;
  finalizedReplays.clear();
  unsubscribe?.();
  unsubscribe = null;
}

registerStoreRollbackParticipant({
  checkpoint: checkpointLiveReplayRecording,
  isCurrent: (checkpoint) => isLiveReplayRecordingCheckpointCurrent(
    checkpoint as LiveReplayRecordingCheckpoint,
  ),
  rollback: (checkpoint) => {
    rollbackLiveReplayRecording(checkpoint as LiveReplayRecordingCheckpoint);
  },
});
