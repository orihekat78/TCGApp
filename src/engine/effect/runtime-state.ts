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
type PendingGlobalAccess = {
  readonly present: boolean;
  value: unknown;
  remove(): void;
};

const pendingGlobals = globalThis as unknown as PendingGlobals;
const hasOwnPendingGlobal = (key: PendingKey): boolean =>
  Object.prototype.hasOwnProperty.call(pendingGlobals, key);
const PENDING_GLOBAL_ACCESS = {
  __pendingActionExpansion: {
    get present() { return hasOwnPendingGlobal('__pendingActionExpansion'); },
    get value() { return pendingGlobals.__pendingActionExpansion; },
    set value(value) { pendingGlobals.__pendingActionExpansion = value; },
    remove() { delete pendingGlobals.__pendingActionExpansion; },
  },
  __pendingChainContinuation: {
    get present() { return hasOwnPendingGlobal('__pendingChainContinuation'); },
    get value() { return pendingGlobals.__pendingChainContinuation; },
    set value(value) { pendingGlobals.__pendingChainContinuation = value; },
    remove() { delete pendingGlobals.__pendingChainContinuation; },
  },
  __pendingChooseInterceptResume: {
    get present() { return hasOwnPendingGlobal('__pendingChooseInterceptResume'); },
    get value() { return pendingGlobals.__pendingChooseInterceptResume; },
    set value(value) { pendingGlobals.__pendingChooseInterceptResume = value; },
    remove() { delete pendingGlobals.__pendingChooseInterceptResume; },
  },
  __pendingChooseInterceptSide: {
    get present() { return hasOwnPendingGlobal('__pendingChooseInterceptSide'); },
    get value() { return pendingGlobals.__pendingChooseInterceptSide; },
    set value(value) { pendingGlobals.__pendingChooseInterceptSide = value; },
    remove() { delete pendingGlobals.__pendingChooseInterceptSide; },
  },
  __pendingContactStartAxId: {
    get present() { return hasOwnPendingGlobal('__pendingContactStartAxId'); },
    get value() { return pendingGlobals.__pendingContactStartAxId; },
    set value(value) { pendingGlobals.__pendingContactStartAxId = value; },
    remove() { delete pendingGlobals.__pendingContactStartAxId; },
  },
  __pendingDeckPlaceSide: {
    get present() { return hasOwnPendingGlobal('__pendingDeckPlaceSide'); },
    get value() { return pendingGlobals.__pendingDeckPlaceSide; },
    set value(value) { pendingGlobals.__pendingDeckPlaceSide = value; },
    remove() { delete pendingGlobals.__pendingDeckPlaceSide; },
  },
  __pendingDeckReorderSide: {
    get present() { return hasOwnPendingGlobal('__pendingDeckReorderSide'); },
    get value() { return pendingGlobals.__pendingDeckReorderSide; },
    set value(value) { pendingGlobals.__pendingDeckReorderSide = value; },
    remove() { delete pendingGlobals.__pendingDeckReorderSide; },
  },
  __pendingDeckRevealSide: {
    get present() { return hasOwnPendingGlobal('__pendingDeckRevealSide'); },
    get value() { return pendingGlobals.__pendingDeckRevealSide; },
    set value(value) { pendingGlobals.__pendingDeckRevealSide = value; },
    remove() { delete pendingGlobals.__pendingDeckRevealSide; },
  },
  __pendingEffectChoiceResume: {
    get present() { return hasOwnPendingGlobal('__pendingEffectChoiceResume'); },
    get value() { return pendingGlobals.__pendingEffectChoiceResume; },
    set value(value) { pendingGlobals.__pendingEffectChoiceResume = value; },
    remove() { delete pendingGlobals.__pendingEffectChoiceResume; },
  },
  __pendingEffectChoiceSide: {
    get present() { return hasOwnPendingGlobal('__pendingEffectChoiceSide'); },
    get value() { return pendingGlobals.__pendingEffectChoiceSide; },
    set value(value) { pendingGlobals.__pendingEffectChoiceSide = value; },
    remove() { delete pendingGlobals.__pendingEffectChoiceSide; },
  },
  __pendingEffectOptionalBindings: {
    get present() { return hasOwnPendingGlobal('__pendingEffectOptionalBindings'); },
    get value() { return pendingGlobals.__pendingEffectOptionalBindings; },
    set value(value) { pendingGlobals.__pendingEffectOptionalBindings = value; },
    remove() { delete pendingGlobals.__pendingEffectOptionalBindings; },
  },
  __pendingEffectOptionalContinuation: {
    get present() { return hasOwnPendingGlobal('__pendingEffectOptionalContinuation'); },
    get value() { return pendingGlobals.__pendingEffectOptionalContinuation; },
    set value(value) { pendingGlobals.__pendingEffectOptionalContinuation = value; },
    remove() { delete pendingGlobals.__pendingEffectOptionalContinuation; },
  },
  __pendingEffectOptionalCostPaid: {
    get present() { return hasOwnPendingGlobal('__pendingEffectOptionalCostPaid'); },
    get value() { return pendingGlobals.__pendingEffectOptionalCostPaid; },
    set value(value) { pendingGlobals.__pendingEffectOptionalCostPaid = value; },
    remove() { delete pendingGlobals.__pendingEffectOptionalCostPaid; },
  },
  __pendingEffectOptionalResume: {
    get present() { return hasOwnPendingGlobal('__pendingEffectOptionalResume'); },
    get value() { return pendingGlobals.__pendingEffectOptionalResume; },
    set value(value) { pendingGlobals.__pendingEffectOptionalResume = value; },
    remove() { delete pendingGlobals.__pendingEffectOptionalResume; },
  },
  __pendingEffectOptionalSide: {
    get present() { return hasOwnPendingGlobal('__pendingEffectOptionalSide'); },
    get value() { return pendingGlobals.__pendingEffectOptionalSide; },
    set value(value) { pendingGlobals.__pendingEffectOptionalSide = value; },
    remove() { delete pendingGlobals.__pendingEffectOptionalSide; },
  },
  __pendingEffectPickQueue: {
    get present() { return hasOwnPendingGlobal('__pendingEffectPickQueue'); },
    get value() { return pendingGlobals.__pendingEffectPickQueue; },
    set value(value) { pendingGlobals.__pendingEffectPickQueue = value; },
    remove() { delete pendingGlobals.__pendingEffectPickQueue; },
  },
  __pendingEffectPickSide: {
    get present() { return hasOwnPendingGlobal('__pendingEffectPickSide'); },
    get value() { return pendingGlobals.__pendingEffectPickSide; },
    set value(value) { pendingGlobals.__pendingEffectPickSide = value; },
    remove() { delete pendingGlobals.__pendingEffectPickSide; },
  },
  __pendingEffectRepeatOptionalResume: {
    get present() { return hasOwnPendingGlobal('__pendingEffectRepeatOptionalResume'); },
    get value() { return pendingGlobals.__pendingEffectRepeatOptionalResume; },
    set value(value) { pendingGlobals.__pendingEffectRepeatOptionalResume = value; },
    remove() { delete pendingGlobals.__pendingEffectRepeatOptionalResume; },
  },
  __pendingEffectRepeatOptionalSide: {
    get present() { return hasOwnPendingGlobal('__pendingEffectRepeatOptionalSide'); },
    get value() { return pendingGlobals.__pendingEffectRepeatOptionalSide; },
    set value(value) { pendingGlobals.__pendingEffectRepeatOptionalSide = value; },
    remove() { delete pendingGlobals.__pendingEffectRepeatOptionalSide; },
  },
  __pendingHirameki: {
    get present() { return hasOwnPendingGlobal('__pendingHirameki'); },
    get value() { return pendingGlobals.__pendingHirameki; },
    set value(value) { pendingGlobals.__pendingHirameki = value; },
    remove() { delete pendingGlobals.__pendingHirameki; },
  },
  __pendingMisread: {
    get present() { return hasOwnPendingGlobal('__pendingMisread'); },
    get value() { return pendingGlobals.__pendingMisread; },
    set value(value) { pendingGlobals.__pendingMisread = value; },
    remove() { delete pendingGlobals.__pendingMisread; },
  },
  __pendingPublicHandRevealSide: {
    get present() { return hasOwnPendingGlobal('__pendingPublicHandRevealSide'); },
    get value() { return pendingGlobals.__pendingPublicHandRevealSide; },
    set value(value) { pendingGlobals.__pendingPublicHandRevealSide = value; },
    remove() { delete pendingGlobals.__pendingPublicHandRevealSide; },
  },
  __pendingRpsBindings: {
    get present() { return hasOwnPendingGlobal('__pendingRpsBindings'); },
    get value() { return pendingGlobals.__pendingRpsBindings; },
    set value(value) { pendingGlobals.__pendingRpsBindings = value; },
    remove() { delete pendingGlobals.__pendingRpsBindings; },
  },
  __pendingRpsContinuation: {
    get present() { return hasOwnPendingGlobal('__pendingRpsContinuation'); },
    get value() { return pendingGlobals.__pendingRpsContinuation; },
    set value(value) { pendingGlobals.__pendingRpsContinuation = value; },
    remove() { delete pendingGlobals.__pendingRpsContinuation; },
  },
  __pendingRpsResume: {
    get present() { return hasOwnPendingGlobal('__pendingRpsResume'); },
    get value() { return pendingGlobals.__pendingRpsResume; },
    set value(value) { pendingGlobals.__pendingRpsResume = value; },
    remove() { delete pendingGlobals.__pendingRpsResume; },
  },
  __pendingRpsSide: {
    get present() { return hasOwnPendingGlobal('__pendingRpsSide'); },
    get value() { return pendingGlobals.__pendingRpsSide; },
    set value(value) { pendingGlobals.__pendingRpsSide = value; },
    remove() { delete pendingGlobals.__pendingRpsSide; },
  },
  __pendingSetCardChoiceBindings: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardChoiceBindings'); },
    get value() { return pendingGlobals.__pendingSetCardChoiceBindings; },
    set value(value) { pendingGlobals.__pendingSetCardChoiceBindings = value; },
    remove() { delete pendingGlobals.__pendingSetCardChoiceBindings; },
  },
  __pendingSetCardChoiceContinuation: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardChoiceContinuation'); },
    get value() { return pendingGlobals.__pendingSetCardChoiceContinuation; },
    set value(value) { pendingGlobals.__pendingSetCardChoiceContinuation = value; },
    remove() { delete pendingGlobals.__pendingSetCardChoiceContinuation; },
  },
  __pendingSetCardChoiceGuard: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardChoiceGuard'); },
    get value() { return pendingGlobals.__pendingSetCardChoiceGuard; },
    set value(value) { pendingGlobals.__pendingSetCardChoiceGuard = value; },
    remove() { delete pendingGlobals.__pendingSetCardChoiceGuard; },
  },
  __pendingSetCardChoiceResume: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardChoiceResume'); },
    get value() { return pendingGlobals.__pendingSetCardChoiceResume; },
    set value(value) { pendingGlobals.__pendingSetCardChoiceResume = value; },
    remove() { delete pendingGlobals.__pendingSetCardChoiceResume; },
  },
  __pendingSetCardChoiceSide: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardChoiceSide'); },
    get value() { return pendingGlobals.__pendingSetCardChoiceSide; },
    set value(value) { pendingGlobals.__pendingSetCardChoiceSide = value; },
    remove() { delete pendingGlobals.__pendingSetCardChoiceSide; },
  },
  __pendingSetCardReplacementSide: {
    get present() { return hasOwnPendingGlobal('__pendingSetCardReplacementSide'); },
    get value() { return pendingGlobals.__pendingSetCardReplacementSide; },
    set value(value) { pendingGlobals.__pendingSetCardReplacementSide = value; },
    remove() { delete pendingGlobals.__pendingSetCardReplacementSide; },
  },
  __pendingRuntimeStateMarker: {
    get present() { return hasOwnPendingGlobal('__pendingRuntimeStateMarker'); },
    get value() { return pendingGlobals.__pendingRuntimeStateMarker; },
    set value(value) { pendingGlobals.__pendingRuntimeStateMarker = value; },
    remove() { delete pendingGlobals.__pendingRuntimeStateMarker; },
  },
} satisfies Record<PendingKey, PendingGlobalAccess>;

function pendingGlobalAccess(key: PendingKey): PendingGlobalAccess {
  if (!Object.prototype.hasOwnProperty.call(PENDING_GLOBAL_ACCESS, key)) {
    throw new Error(`unknown pending runtime key: ${String(key)}`);
  }
  const access = (PENDING_GLOBAL_ACCESS as Record<string, PendingGlobalAccess>)[key];
  if (!access) throw new Error(`unknown pending runtime key: ${String(key)}`);
  return access;
}

export type PendingRuntimeSnapshot = ReadonlyArray<{
  key: PendingKey;
  present: boolean;
  value: unknown;
}>;

/** Capture every module side channel participating in one public dispatch. */
export function snapshotPendingRuntimeState(): PendingRuntimeSnapshot {
  return TRANSACTIONAL_PENDING_KEYS.map((key) => {
    const access = pendingGlobalAccess(key);
    return {
      key,
      present: access.present,
      value: key === '__pendingRuntimeStateMarker'
        ? access.value
        : toPlainDeep(access.value),
    };
  });
}

/** Restore consumed holders, queues, and newly-created decisions after failure. */
export function restorePendingRuntimeState(snapshot: PendingRuntimeSnapshot): void {
  const entries = snapshot.map((entry) => ({
    access: pendingGlobalAccess(entry.key),
    entry,
  }));
  for (const { access, entry } of entries) {
    if (entry.present) {
      access.value = entry.key === '__pendingRuntimeStateMarker'
        ? entry.value
        : toPlainDeep(entry.value);
    }
    else access.remove();
  }
}

/** Clear every live resolver side channel before installing another authority. */
export function resetPendingRuntimeState(): void {
  for (const key of TRANSACTIONAL_PENDING_KEYS) pendingGlobalAccess(key).remove();
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
