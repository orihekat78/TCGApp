import {
  _drainPendingEffectPickSide,
  _peekPendingEffectChoiceSide,
  _peekPendingEffectOptionalSide,
  _peekPendingEffectPickSide,
  _peekPendingRpsResume,
  _peekPendingRpsSide,
  getPendingChoiceResume,
  getPendingOptionalResume,
  toPlainDeep,
  type PendingEffectChoiceSide,
  type PendingEffectOptionalSide,
  type PendingEffectPickSide,
  type PendingRpsSide,
} from './pending-state.js';
import {
  _peekPendingDeckPlaceSide,
  _peekPendingDeckReorderSide,
  type PendingDeckPlaceSide,
  type PendingDeckReorderSide,
} from './atom-handlers/_shared.js';
import { assertPendingRuntimeValue } from './pending-runtime-schema.js';
import type { GameState } from '../types/game-state.js';
import { isDraft, original } from '../produce.js';

const TRANSACTIONAL_PENDING_KEYS = [
  '__pendingActionExpansion',
  '__pendingChainContinuation',
  '__pendingChooseInterceptResume',
  '__pendingChooseInterceptSide',
  '__pendingContactStartAxId',
  '__pendingDeckPlaceSide',
  '__pendingDeckReorderSide',
  '__pendingDeckRevealSide',
  '__pendingEffectChoiceResume',
  '__pendingEffectChoiceSide',
  '__pendingEffectOptionalBindings',
  '__pendingEffectOptionalContinuation',
  '__pendingEffectOptionalCostPaid',
  '__pendingEffectOptionalResume',
  '__pendingEffectOptionalSide',
  '__pendingEffectPickQueue',
  '__pendingEffectPickSide',
  '__pendingEffectRepeatOptionalResume',
  '__pendingEffectRepeatOptionalSide',
  '__pendingHirameki',
  '__pendingMisread',
  '__pendingPublicHandRevealSide',
  '__pendingRpsBindings',
  '__pendingRpsContinuation',
  '__pendingRpsResume',
  '__pendingRpsSide',
  '__pendingSetCardChoiceBindings',
  '__pendingSetCardChoiceContinuation',
  '__pendingSetCardChoiceGuard',
  '__pendingSetCardChoiceResume',
  '__pendingSetCardChoiceSide',
  '__pendingSetCardReplacementGuard',
  '__pendingSetCardReplacementSide',
  '__pendingRuntimeStateMarker',
] as const;

const TRANSACTIONAL_PENDING_KEY_SET = new Set<string>(TRANSACTIONAL_PENDING_KEYS);

type PendingKey = (typeof TRANSACTIONAL_PENDING_KEYS)[number];
type PendingGlobals = Record<PendingKey, unknown>;
type PersistedPendingRuntimeState = NonNullable<GameState['pendingRuntimeState']>;
type PendingRuntimeMarker = {
  token: number;
  owner: PersistedPendingRuntimeState;
} | undefined;

export type PendingRuntimeSnapshot = ReadonlyArray<{
  key: PendingKey;
  present: boolean;
  value: unknown;
}>;

/** Capture every module side channel participating in one public dispatch. */
export function snapshotPendingRuntimeState(): PendingRuntimeSnapshot {
  const globals = globalThis as unknown as PendingGlobals;
  return TRANSACTIONAL_PENDING_KEYS.map((key) => {
    const present = Object.prototype.hasOwnProperty.call(globalThis, key);
    const value = globals[key];
    if (present) {
      assertPendingRuntimeValue(key, value, { allowMarker: true, mode: 'live' });
    }
    return {
      key,
      present,
      value: key === '__pendingRuntimeStateMarker' ? value : toPlainDeep(value),
    };
  });
}

function preparePendingRuntimeSnapshot(
  snapshot: PendingRuntimeSnapshot,
  options: { persisted?: boolean } = {},
): Array<{ key: PendingKey; present: boolean; value: unknown }> {
  if (!Array.isArray(snapshot)) {
    throw new Error('Invalid pending runtime snapshot: expected an array');
  }
  const seen = new Set<PendingKey>();
  const validated = Array.from(snapshot.entries(), ([index, entry]) => {
    if (entry === null || typeof entry !== 'object') {
      throw new Error(`Invalid pending runtime snapshot entry at index ${index}`);
    }
    if (!TRANSACTIONAL_PENDING_KEY_SET.has(entry.key)) {
      throw new Error(`Invalid pending runtime snapshot key at index ${index}`);
    }
    const key = entry.key as PendingKey;
    if (seen.has(key)) {
      throw new Error(`Invalid pending runtime snapshot duplicate key at index ${index}`);
    }
    seen.add(key);
    if (typeof entry.present !== 'boolean') {
      throw new Error(`Invalid pending runtime snapshot presence at index ${index}`);
    }
    if (entry.present) {
      assertPendingRuntimeValue(key, entry.value, {
        allowMarker: options.persisted !== true,
        mode: options.persisted ? 'persisted' : 'live',
      });
    }
    else if (entry.value !== undefined) {
      throw new Error(`Invalid pending runtime snapshot at index ${index}: absent entries cannot contain a value`);
    }
    return {
      key,
      present: entry.present,
      value: !entry.present
        ? undefined
        : key === '__pendingRuntimeStateMarker'
          ? entry.value
          : toPlainDeep(entry.value),
    };
  });

  if (options.persisted !== true) return validated;
  const entries = new Map(validated.map((entry) => [entry.key, entry]));
  return TRANSACTIONAL_PENDING_KEYS.map((key) => entries.get(key) ?? {
    key,
    present: false,
    value: undefined,
  });
}

function applyPendingRuntimeSnapshot(
  validated: ReadonlyArray<{ key: PendingKey; present: boolean; value: unknown }>,
): void {
  const globals = globalThis as unknown as PendingGlobals;
  for (const entry of validated) {
    if (entry.present) {
      globals[entry.key] = entry.value;
    }
    else delete globals[entry.key];
  }
}

function assertPendingRuntimeMatchesState(
  state: GameState,
  snapshot: ReadonlyArray<{ key: PendingKey; present: boolean; value: unknown }>,
): void {
  const deckPlace = snapshot.find(entry => entry.key === '__pendingDeckPlaceSide' && entry.present);
  if (!deckPlace || deckPlace.value === null) return;
  const pending = deckPlace.value as {
    player: 'self' | 'opp';
    deckSnapshot: string[];
  };
  const deck = state.players[pending.player].deck;
  if (deck.length !== pending.deckSnapshot.length
      || deck.some((cardId, index) => cardId !== pending.deckSnapshot[index])) {
    throw new Error('Invalid pendingDeckPlace: deckSnapshot must match current player deck');
  }
}

/** Restore consumed holders, queues, and newly-created decisions after failure. */
export function restorePendingRuntimeState(
  snapshot: PendingRuntimeSnapshot,
  options: { persisted?: boolean } = {},
): void {
  applyPendingRuntimeSnapshot(preparePendingRuntimeSnapshot(snapshot, options));
}

/** Clear every live resolver side channel before installing another authority. */
export function resetPendingRuntimeState(): void {
  const globals = globalThis as unknown as PendingGlobals;
  for (const key of TRANSACTIONAL_PENDING_KEYS) delete globals[key];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function retainedTerminalPresentationValue(key: PendingKey, value: unknown): unknown | undefined {
  if (key !== '__pendingDeckRevealSide' && key !== '__pendingPublicHandRevealSide') return undefined;
  const items = (Array.isArray(value) ? value : [value]).filter((item) => {
    const record = recordValue(item);
    if (record === null) return false;
    return key === '__pendingDeckRevealSide'
      ? record.awaitingPick !== true
      : record.lifetime === 'presentation';
  });
  if (items.length === 0) return undefined;
  return items.length === 1 ? items[0] : items;
}

/**
 * End an active resolver session without discarding completed public outputs.
 * Decision-bearing channels remain unsafe after game end and are always reset.
 */
export function resetPendingRuntimeStateAfterGameEnd(options: {
  preserveCompletedPresentations: boolean;
}): void {
  const retained = options.preserveCompletedPresentations
    ? snapshotPendingRuntimeState().flatMap((entry) => {
        const value = entry.present
          ? retainedTerminalPresentationValue(entry.key, entry.value)
          : undefined;
        return value === undefined
          ? []
          : [{ key: entry.key, present: true, value }];
      })
    : [];
  resetPendingRuntimeState();
  if (retained.length > 0) restorePendingRuntimeState(retained);
}

/**
 * Run one state authority without observing or consuming another session's
 * live resolver continuations. The caller's runtime is restored on every exit.
 */
export function withIsolatedPendingRuntimeState<T>(
  authority: GameState,
  run: () => T,
): T {
  const callerRuntime = snapshotPendingRuntimeState();
  try {
    resetPendingRuntimeState();
    hydratePendingRuntimeState(authority);
    return run();
  } finally {
    restorePendingRuntimeState(callerRuntime);
  }
}

function readPendingAuthority<T>(state: GameState, read: () => T | null): T | null {
  try {
    return withIsolatedPendingRuntimeState(state, read);
  } catch {
    // Public decision admission is fail-closed. Dedicated hydrate/import paths
    // retain the throwing validator for corrupt persisted state diagnostics.
    return null;
  }
}

/** Read the resolver-owned pick without lending UI state execution authority. */
export function readPendingEffectPickAuthority(
  state: GameState,
): PendingEffectPickSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingEffectPickSide();
    return pending === null ? null : toPlainDeep(pending);
  });
}

/**
 * Cancel one persisted pick by its stable public-reveal token.
 * UI projections are deep clones, so reference identity must never decide
 * whether the resolver-owned prompt is removed.
 */
export function cancelPendingEffectPickByPublicRevealToken(
  state: GameState,
  resolutionToken: string,
): boolean {
  return withIsolatedPendingRuntimeState(state, () => {
    const pending = _peekPendingEffectPickSide();
    if (pending?.publicHandRevealToken !== resolutionToken) return false;
    _drainPendingEffectPickSide();
    persistPendingRuntimeState(state);
    return true;
  });
}

/**
 * Adopt a newly committed persisted snapshot without rehydrating its queues.
 * Use only after the active GameState commit succeeds: the live FIFO already
 * contains the unsurfaced siblings, while its marker still names the previous
 * Immer owner restored by withIsolatedPendingRuntimeState().
 */
export function rebindPendingRuntimeStateOwner(state: GameState): void {
  const persisted = state.pendingRuntimeState;
  if (!persisted) {
    setMarker(undefined);
    return;
  }
  assertPendingRuntimeToken(persisted.token);
  setMarker({ token: persisted.token, owner: persistedOwner(persisted) });
}

/** Read the resolver-owned choice only while its engine resume holder exists. */
export function readPendingEffectChoiceAuthority(
  state: GameState,
): PendingEffectChoiceSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingEffectChoiceSide();
    if (pending === null || getPendingChoiceResume() === null) return null;
    return toPlainDeep(pending);
  });
}

/** Read the resolver-owned optional only while its engine resume holder exists. */
export function readPendingEffectOptionalAuthority(
  state: GameState,
): PendingEffectOptionalSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingEffectOptionalSide();
    if (pending === null || getPendingOptionalResume() === null) return null;
    return toPlainDeep(pending);
  });
}

/** Read the resolver-owned RPS prompt only while its engine resume holder exists. */
export function readPendingRpsAuthority(
  state: GameState,
): PendingRpsSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingRpsSide();
    if (pending === null || _peekPendingRpsResume() === null) return null;
    return toPlainDeep(pending);
  });
}

/** Read a resolver-owned deck reorder without trusting its mutable UI copy. */
export function readPendingDeckReorderAuthority(
  state: GameState,
): PendingDeckReorderSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingDeckReorderSide();
    return pending === null ? null : toPlainDeep(pending);
  });
}

/** Read a resolver-owned deck placement without trusting its mutable UI copy. */
export function readPendingDeckPlaceAuthority(
  state: GameState,
): PendingDeckPlaceSide | null {
  return readPendingAuthority(state, () => {
    const pending = _peekPendingDeckPlaceSide();
    return pending === null ? null : toPlainDeep(pending);
  });
}

function marker(): PendingRuntimeMarker {
  return (globalThis as { __pendingRuntimeStateMarker?: PendingRuntimeMarker })
    .__pendingRuntimeStateMarker;
}

function setMarker(value: PendingRuntimeMarker): void {
  const globals = globalThis as { __pendingRuntimeStateMarker?: PendingRuntimeMarker };
  if (value === undefined) delete globals.__pendingRuntimeStateMarker;
  else globals.__pendingRuntimeStateMarker = value;
}

function persistedOwner(
  persisted: PersistedPendingRuntimeState,
): PersistedPendingRuntimeState {
  return isDraft(persisted)
    ? (original(persisted) as PersistedPendingRuntimeState | undefined) ?? persisted
    : persisted;
}

function assertPendingRuntimeToken(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error('Invalid pending runtime token');
  }
}

function assertPendingRuntimeSequence(value: unknown): asserts value is number | undefined {
  if (value !== undefined
    && (!Number.isSafeInteger(value) || (value as number) < 0)) {
    throw new Error('Invalid pending runtime sequence');
  }
}

function nextPendingRuntimeToken(state: GameState): number {
  const activeToken = state.pendingRuntimeState?.token as unknown;
  const sequence = state.pendingRuntimeSeq as unknown;
  assertPendingRuntimeSequence(sequence);
  if (activeToken !== undefined) {
    assertPendingRuntimeToken(activeToken);
    return activeToken;
  }
  const token = (sequence as number | undefined ?? 0) + 1;
  assertPendingRuntimeToken(token);
  return token;
}

/**
 * Persist the live human-decision cache at a resolver pause boundary.
 * Repeated pauses in one continuation retain the same token and replace the
 * snapshot after the prior answer has been consumed.
 */
export function persistPendingRuntimeState(state: GameState): void {
  const token = nextPendingRuntimeToken(state);
  const preparedSnapshot = preparePendingRuntimeSnapshot(
    snapshotPendingRuntimeState()
      .filter((entry) => entry.key !== '__pendingRuntimeStateMarker'),
    { persisted: true },
  );
  assertPendingRuntimeMatchesState(state, preparedSnapshot);
  const persisted: PersistedPendingRuntimeState = {
    token,
    snapshot: preparedSnapshot
      .filter((entry) => entry.key !== '__pendingRuntimeStateMarker')
      .map((entry) => ({ ...entry })),
  };
  state.pendingRuntimeSeq = Math.max(state.pendingRuntimeSeq ?? 0, token);
  state.pendingRuntimeState = persisted;
  setMarker({ token, owner: persistedOwner(persisted) });
}

/**
 * Rehydrate only after a process/session boundary. During a live session the
 * marker prevents a consumed UI prompt from being restored from stale state.
 */
export function hydratePendingRuntimeState(state: GameState): boolean {
  const persisted = state.pendingRuntimeState;
  assertPendingRuntimeSequence(state.pendingRuntimeSeq);
  if (persisted !== undefined) assertPendingRuntimeToken(persisted.token);
  if (!persisted) return false;
  const preparedSnapshot = preparePendingRuntimeSnapshot(
    persisted.snapshot as PendingRuntimeSnapshot,
    { persisted: true },
  );
  const currentMarker = marker();
  if (currentMarker?.token === persisted.token
      && currentMarker.owner === persistedOwner(persisted)) return false;
  assertPendingRuntimeMatchesState(state, preparedSnapshot);
  applyPendingRuntimeSnapshot(preparedSnapshot);
  setMarker({ token: persisted.token, owner: persistedOwner(persisted) });
  return true;
}

/** Remove a completed continuation from both GameState and the live cache. */
export function clearPersistedPendingRuntimeState(state: GameState): void {
  const persisted = state.pendingRuntimeState;
  delete state.pendingRuntimeState;
  const currentMarker = marker();
  if (persisted
    && currentMarker?.token === persisted.token
    && currentMarker.owner === persistedOwner(persisted)) setMarker(undefined);
}
