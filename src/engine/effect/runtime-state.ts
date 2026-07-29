import { toPlainDeep } from './pending-state.js';
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
  '__pendingSetCardReplacementSide',
  '__pendingRuntimeStateMarker',
] as const;

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
  return TRANSACTIONAL_PENDING_KEYS.map((key) => ({
    key,
    present: Object.prototype.hasOwnProperty.call(globalThis, key),
    value: key === '__pendingRuntimeStateMarker'
      ? globals[key]
      : toPlainDeep(globals[key]),
  }));
}

/** Restore consumed holders, queues, and newly-created decisions after failure. */
export function restorePendingRuntimeState(snapshot: PendingRuntimeSnapshot): void {
  const globals = globalThis as unknown as PendingGlobals;
  for (const entry of snapshot) {
    if (entry.present) {
      globals[entry.key] = entry.key === '__pendingRuntimeStateMarker'
        ? entry.value
        : toPlainDeep(entry.value);
    }
    else delete globals[entry.key];
  }
}

/** Clear every live resolver side channel before installing another authority. */
export function resetPendingRuntimeState(): void {
  const globals = globalThis as unknown as PendingGlobals;
  for (const key of TRANSACTIONAL_PENDING_KEYS) delete globals[key];
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

/**
 * Persist the live human-decision cache at a resolver pause boundary.
 * Repeated pauses in one continuation retain the same token and replace the
 * snapshot after the prior answer has been consumed.
 */
export function persistPendingRuntimeState(state: GameState): void {
  const activeToken = state.pendingRuntimeState?.token;
  const token = activeToken ?? (state.pendingRuntimeSeq ?? 0) + 1;
  state.pendingRuntimeSeq = Math.max(state.pendingRuntimeSeq ?? 0, token);
  const persisted: PersistedPendingRuntimeState = {
    token,
    snapshot: snapshotPendingRuntimeState()
      .filter((entry) => entry.key !== '__pendingRuntimeStateMarker')
      .map((entry) => ({ ...entry })),
  };
  state.pendingRuntimeState = persisted;
  setMarker({ token, owner: persistedOwner(persisted) });
}

/**
 * Rehydrate only after a process/session boundary. During a live session the
 * marker prevents a consumed UI prompt from being restored from stale state.
 */
export function hydratePendingRuntimeState(state: GameState): boolean {
  const persisted = state.pendingRuntimeState;
  const currentMarker = marker();
  if (!persisted
    || (currentMarker?.token === persisted.token
      && currentMarker.owner === persistedOwner(persisted))) return false;
  restorePendingRuntimeState(persisted.snapshot as PendingRuntimeSnapshot);
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
