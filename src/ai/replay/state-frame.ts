import type { CausalLogEntryV1, GameState } from '@/engine/types';
import { validateCausalLog } from '@/engine/log/causal';

export type ReplayViewerMode = 'solo-self' | 'spectator';
export type ReplayPatchPath = Array<string | number>;
export type ReplayPatchV1 =
  | { op: 'set'; path: ReplayPatchPath; value: unknown }
  | { op: 'delete'; path: ReplayPatchPath };

export type ReplayFrameV1 = {
  frameId: string;
  sequence: number;
  parentFrameId: string;
  patches: ReplayPatchV1[];
  stateDigest: string;
  causalEventIds: string[];
};

export type ReplayLogV3 = {
  schemaVersion: 3;
  artifactId: string;
  sessionId: string;
  engineBuildId: 'state-frame-v1';
  rulesVersion: '2.4';
  gameStateSchemaVersion: 1;
  presentationSchemaVersion: 1;
  viewerMode: ReplayViewerMode;
  initialFrameId: string;
  initialState: GameState;
  initialStateDigest: string;
  frames: ReplayFrameV1[];
  finalFrameId: string;
  result: {
    winner: 'self' | 'opp';
    reason: 'evidence' | 'deck-out' | 'concede' | 'alt-lose';
    turns: number;
  };
};

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_REPLAY_FRAMES = 4_096;
const MAX_PATCHES_PER_FRAME = 65_536;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertSafeKey(key: string): void {
  if (UNSAFE_KEYS.has(key)) throw new Error(`Unsafe replay patch path: ${key}`);
}

function assertSafeJson(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Replay state contains a non-finite number');
    return;
  }
  if (typeof value !== 'object') throw new Error('Replay state is not JSON-safe');
  if (seen.has(value)) throw new Error('Replay state contains a cycle');
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) assertSafeJson(entry, seen);
  } else {
    for (const [key, entry] of Object.entries(value)) {
      assertSafeKey(key);
      if (entry !== undefined) assertSafeJson(entry, seen);
    }
  }
  seen.delete(value);
}

function jsonClone<T>(value: T): T {
  assertSafeJson(value);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Replay value cannot be serialized');
  return JSON.parse(serialized) as T;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => {
        assertSafeKey(key);
        return [key, canonicalValue(value[key])];
      }),
    );
  }
  return value;
}

export function canonicalReplayJson(value: unknown): string {
  return JSON.stringify(canonicalValue(jsonClone(value)));
}

export function stableDigest(value: unknown): string {
  const text = canonicalReplayJson(value);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64-${hash.toString(16).padStart(16, '0')}`;
}

function appendDiff(previous: unknown, next: unknown, path: ReplayPatchPath, patches: ReplayPatchV1[]): void {
  if (Object.is(previous, next)) return;
  if (Array.isArray(previous) && Array.isArray(next)) {
    if (previous.length !== next.length) {
      patches.push({ op: 'set', path, value: jsonClone(next) });
      return;
    }
    const start = patches.length;
    for (let index = 0; index < next.length; index += 1) {
      appendDiff(previous[index], next[index], [...path, index], patches);
    }
    if (patches.length - start > Math.max(8, Math.ceil(next.length / 2))) {
      patches.splice(start, patches.length - start, { op: 'set', path, value: jsonClone(next) });
    }
    return;
  }
  if (isRecord(previous) && isRecord(next)) {
    const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort();
    for (const key of keys) {
      assertSafeKey(key);
      if (!(key in next)) patches.push({ op: 'delete', path: [...path, key] });
      else if (!(key in previous)) patches.push({ op: 'set', path: [...path, key], value: jsonClone(next[key]) });
      else appendDiff(previous[key], next[key], [...path, key], patches);
    }
    return;
  }
  if (path.length === 0) throw new Error('Replay root replacement is not supported');
  patches.push({ op: 'set', path, value: jsonClone(next) });
}

function assertPatchPath(path: unknown): asserts path is ReplayPatchPath {
  if (!Array.isArray(path) || path.length === 0 || path.length > 128) {
    throw new Error('Invalid replay patch path');
  }
  for (const part of path) {
    if (typeof part === 'string') assertSafeKey(part);
    else if (!Number.isSafeInteger(part) || Number(part) < 0) throw new Error('Invalid replay patch index');
  }
}

export function applyReplayPatches(state: GameState, patches: readonly ReplayPatchV1[]): GameState {
  if (!Array.isArray(patches) || patches.length > MAX_PATCHES_PER_FRAME) {
    throw new Error('Invalid replay patch list');
  }
  const next = jsonClone(state) as unknown;
  for (const patch of patches) {
    if (!isRecord(patch) || (patch.op !== 'set' && patch.op !== 'delete')) {
      throw new Error('Invalid replay patch operation');
    }
    assertPatchPath(patch.path);
    let owner: unknown = next;
    for (let index = 0; index < patch.path.length - 1; index += 1) {
      const part = patch.path[index]!;
      if (Array.isArray(owner)) {
        if (typeof part !== 'number' || part >= owner.length) throw new Error('Invalid replay patch array path');
        owner = owner[part];
      } else if (isRecord(owner)) {
        if (typeof part !== 'string' || !(part in owner)) throw new Error('Invalid replay patch object path');
        owner = owner[part];
      } else throw new Error('Replay patch traverses a scalar');
    }
    const leaf = patch.path.at(-1)!;
    if (Array.isArray(owner)) {
      if (typeof leaf !== 'number' || leaf >= owner.length || patch.op === 'delete') {
        throw new Error('Invalid replay array mutation');
      }
      owner[leaf] = jsonClone(patch.value);
    } else if (isRecord(owner)) {
      if (typeof leaf !== 'string') throw new Error('Invalid replay object key');
      assertSafeKey(leaf);
      if (patch.op === 'delete') delete owner[leaf];
      else owner[leaf] = jsonClone(patch.value);
    } else throw new Error('Replay patch owner is a scalar');
  }
  return next as GameState;
}

function causalEntries(state: GameState): CausalLogEntryV1[] {
  const entries: CausalLogEntryV1[] = [];
  for (const entry of state.log) {
    if (!isRecord(entry) || !('schemaVersion' in entry)) continue;
    if (entry.schemaVersion !== 1) throw new Error('Unsupported replay causal schema');
    entries.push(entry as CausalLogEntryV1);
  }
  return entries;
}

function validateStateSession(state: GameState, sessionId: string): void {
  if (state.causalLog?.sessionId !== sessionId) throw new Error('Replay state session mismatch');
  const entries = causalEntries(state);
  validateCausalLog(entries);
  if (entries.some((entry) => entry.sessionId !== sessionId)) throw new Error('Cross-session replay causal graph');
  entries.forEach((entry, index) => {
    if (entry.sequence !== index + 1) throw new Error('Replay causal append order mismatch');
  });
  if (state.causalLog.nextSequence !== entries.length + 1) {
    throw new Error('Replay causal allocator mismatch');
  }
}

function newlyVisibleEventIds(previous: GameState, next: GameState): string[] {
  const before = causalEntries(previous);
  const after = causalEntries(next);
  if (after.length < before.length) throw new Error('Replay causal history is not an immutable prefix');
  for (let index = 0; index < before.length; index += 1) {
    if (canonicalReplayJson(before[index]) !== canonicalReplayJson(after[index])) {
      throw new Error('Replay causal history is not an immutable prefix');
    }
  }
  return after.slice(before.length).map((entry) => entry.eventId);
}

function assertTerminalCausalBoundary(state: GameState): void {
  const entries = causalEntries(state);
  const terminalEntries = entries.filter((entry) => entry.kind === 'game-result');
  if (!state.gameResult) {
    if (terminalEntries.length > 0) throw new Error('Replay terminal event has no game result');
    return;
  }
  if (terminalEntries.length !== 1) {
    throw new Error('Replay game result requires exactly one terminal game-result event');
  }
  const terminal = terminalEntries[0]!;
  if (entries.at(-1) !== terminal) throw new Error('Replay has a causal event after game-result');

  const winner = state.gameResult.winner;
  const loser = winner === 'self' ? 'opp' : 'self';
  if (terminal.actor !== winner || terminal.player !== winner) {
    throw new Error('Replay terminal actor does not match the winner');
  }
  if (terminal.source?.kind !== 'player' || terminal.source.side !== winner) {
    throw new Error('Replay terminal source does not match the winner');
  }
  if (terminal.outcome.type !== 'state' || terminal.outcome.state !== 'success') {
    throw new Error('Replay terminal outcome must be success');
  }
  if (terminal.turn !== state.turn.number) {
    throw new Error('Replay terminal event turn does not match the terminal state');
  }
  if (terminal.targets.length !== 1
    || terminal.targets[0]?.kind !== 'player'
    || terminal.targets[0].side !== loser) {
    throw new Error('Replay terminal target does not match the loser');
  }
}

export function buildReplayLogV3(input: {
  artifactId: string;
  sessionId: string;
  viewerMode: ReplayViewerMode;
  states: readonly GameState[];
}): ReplayLogV3 {
  if (!input.artifactId.trim() || !input.sessionId.trim()) throw new Error('Invalid replay identity');
  if (input.viewerMode !== 'solo-self' && input.viewerMode !== 'spectator') throw new Error('Invalid replay viewer mode');
  if (!Array.isArray(input.states) || input.states.length === 0) throw new Error('Replay has no states');

  const states: GameState[] = [];
  let priorDigest: string | null = null;
  for (const rawState of input.states) {
    const state = jsonClone(rawState);
    validateStateSession(state, input.sessionId);
    const digest = stableDigest(state);
    if (digest !== priorDigest) states.push(state);
    priorDigest = digest;
  }
  if (states.length > MAX_REPLAY_FRAMES + 1) throw new Error('Replay has too many frames');
  states.forEach((state, index) => {
    assertTerminalCausalBoundary(state);
    if (state.gameResult && index !== states.length - 1) {
      throw new Error('Replay contains a post-terminal state mutation');
    }
  });
  const terminal = states.at(-1)!;
  if (!terminal.gameResult) throw new Error('Replay terminal state is missing a result');

  const initialState = states[0]!;
  const initialFrameId = `${input.artifactId}:0`;
  const frames: ReplayFrameV1[] = [];
  let previous = initialState;
  let parentFrameId = initialFrameId;
  for (let index = 1; index < states.length; index += 1) {
    const state = states[index]!;
    const patches: ReplayPatchV1[] = [];
    appendDiff(previous, state, [], patches);
    const sequence = index;
    const frameId = `${input.artifactId}:${sequence}`;
    frames.push({
      frameId,
      sequence,
      parentFrameId,
      patches,
      stateDigest: stableDigest(state),
      causalEventIds: newlyVisibleEventIds(previous, state),
    });
    previous = state;
    parentFrameId = frameId;
  }

  const log: ReplayLogV3 = {
    schemaVersion: 3,
    artifactId: input.artifactId,
    sessionId: input.sessionId,
    engineBuildId: 'state-frame-v1',
    rulesVersion: '2.4',
    gameStateSchemaVersion: 1,
    presentationSchemaVersion: 1,
    viewerMode: input.viewerMode,
    initialFrameId,
    initialState,
    initialStateDigest: stableDigest(initialState),
    frames,
    finalFrameId: parentFrameId,
    result: {
      winner: terminal.gameResult.winner,
      reason: terminal.gameResult.reason,
      turns: terminal.turn.number,
    },
  };
  assertReplayLogV3(log);
  return log;
}

function assertReplayResult(value: unknown): asserts value is ReplayLogV3['result'] {
  if (!isRecord(value) || (value.winner !== 'self' && value.winner !== 'opp')) throw new Error('Invalid replay result');
  if (!['evidence', 'deck-out', 'concede', 'alt-lose'].includes(String(value.reason))) throw new Error('Invalid replay result reason');
  if (!Number.isSafeInteger(value.turns) || Number(value.turns) < 0) throw new Error('Invalid replay result turns');
}

export function assertReplayLogV3(value: unknown): asserts value is ReplayLogV3 {
  if (!isRecord(value) || value.schemaVersion !== 3) throw new Error('Unsupported replay schema version');
  for (const key of ['artifactId', 'sessionId', 'initialFrameId', 'initialStateDigest', 'finalFrameId'] as const) {
    if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Invalid replay ${key}`);
  }
  if (value.engineBuildId !== 'state-frame-v1' || value.rulesVersion !== '2.4') throw new Error('Unsupported replay build');
  if (value.gameStateSchemaVersion !== 1 || value.presentationSchemaVersion !== 1) throw new Error('Unsupported replay state version');
  if (value.viewerMode !== 'solo-self' && value.viewerMode !== 'spectator') throw new Error('Invalid replay viewer mode');
  if (value.initialFrameId !== `${value.artifactId}:0`) throw new Error('Invalid replay initial frame ID');
  const initialState = jsonClone(value.initialState) as GameState;
  validateStateSession(initialState, value.sessionId as string);
  assertTerminalCausalBoundary(initialState);
  if (stableDigest(initialState) !== value.initialStateDigest) throw new Error('Replay initial state digest mismatch');
  if (!Array.isArray(value.frames) || value.frames.length > MAX_REPLAY_FRAMES) throw new Error('Invalid replay frames');

  let state = initialState;
  let terminalSeen = state.gameResult !== undefined;
  let parentFrameId = value.initialFrameId as string;
  for (let index = 0; index < value.frames.length; index += 1) {
    if (terminalSeen) throw new Error('Replay contains a post-terminal state mutation');
    const frame = value.frames[index];
    if (!isRecord(frame)) throw new Error('Invalid replay frame');
    const sequence = index + 1;
    if (frame.sequence !== sequence || frame.frameId !== `${value.artifactId}:${sequence}`) throw new Error('Replay frame sequence gap');
    if (frame.parentFrameId !== parentFrameId) throw new Error('Replay frame parent mismatch');
    const previousState = state;
    state = applyReplayPatches(state, frame.patches as ReplayPatchV1[]);
    validateStateSession(state, value.sessionId as string);
    assertTerminalCausalBoundary(state);
    terminalSeen = state.gameResult !== undefined;
    if (stableDigest(state) !== frame.stateDigest) throw new Error('Replay frame digest mismatch');
    if (!Array.isArray(frame.causalEventIds) || frame.causalEventIds.some((id) => (
      typeof id !== 'string' || !id.startsWith(`${value.sessionId}:`)
    ))) throw new Error('Invalid replay causal event IDs');
    const expectedEventIds = newlyVisibleEventIds(previousState, state);
    if (
      frame.causalEventIds.length !== expectedEventIds.length
      || frame.causalEventIds.some((id, eventIndex) => id !== expectedEventIds[eventIndex])
    ) {
      throw new Error('Replay causal event delta mismatch');
    }
    parentFrameId = frame.frameId as string;
  }
  if (value.finalFrameId !== parentFrameId) throw new Error('Replay final frame mismatch');
  assertReplayResult(value.result);
  if (!state.gameResult || state.gameResult.winner !== value.result.winner || state.gameResult.reason !== value.result.reason) {
    throw new Error('Replay terminal result mismatch');
  }
  if (state.turn.number !== value.result.turns) throw new Error('Replay terminal turn mismatch');
}

export function replayStepCount(log: ReplayLogV3): number {
  assertReplayLogV3(log);
  return log.frames.length;
}

export function replayStateAt(log: ReplayLogV3, step: number): GameState {
  assertReplayLogV3(log);
  if (!Number.isSafeInteger(step) || step < 0 || step > log.frames.length) throw new Error('Replay step out of range');
  let state = jsonClone(log.initialState);
  for (let index = 0; index < step; index += 1) state = applyReplayPatches(state, log.frames[index]!.patches);
  return state;
}

/** Validate once, then reconstruct the complete ordered state sequence. */
export function replayStates(log: ReplayLogV3): GameState[] {
  assertReplayLogV3(log);
  const states = [jsonClone(log.initialState)];
  let state = states[0]!;
  for (const frame of log.frames) {
    state = applyReplayPatches(state, frame.patches);
    states.push(state);
  }
  return states;
}
