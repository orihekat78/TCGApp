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
const ownPendingData = (value: unknown): PropertyDescriptor => ({
  configurable: true,
  enumerable: true,
  value,
  writable: true,
});
const PENDING_GLOBAL_ACCESS: Record<PendingKey, PendingGlobalAccess> = {
  __pendingActionExpansion: {
    get present() { return hasOwnPendingGlobal("__pendingActionExpansion"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingActionExpansion")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingActionExpansion", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingActionExpansion; },
  },
  __pendingChainContinuation: {
    get present() { return hasOwnPendingGlobal("__pendingChainContinuation"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingChainContinuation")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingChainContinuation", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingChainContinuation; },
  },
  __pendingChooseInterceptResume: {
    get present() { return hasOwnPendingGlobal("__pendingChooseInterceptResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingChooseInterceptResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingChooseInterceptResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingChooseInterceptResume; },
  },
  __pendingChooseInterceptSide: {
    get present() { return hasOwnPendingGlobal("__pendingChooseInterceptSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingChooseInterceptSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingChooseInterceptSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingChooseInterceptSide; },
  },
  __pendingContactStartAxId: {
    get present() { return hasOwnPendingGlobal("__pendingContactStartAxId"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingContactStartAxId")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingContactStartAxId", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingContactStartAxId; },
  },
  __pendingDeckPlaceSide: {
    get present() { return hasOwnPendingGlobal("__pendingDeckPlaceSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingDeckPlaceSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingDeckPlaceSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingDeckPlaceSide; },
  },
  __pendingDeckReorderSide: {
    get present() { return hasOwnPendingGlobal("__pendingDeckReorderSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingDeckReorderSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingDeckReorderSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingDeckReorderSide; },
  },
  __pendingDeckRevealSide: {
    get present() { return hasOwnPendingGlobal("__pendingDeckRevealSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingDeckRevealSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingDeckRevealSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingDeckRevealSide; },
  },
  __pendingEffectChoiceResume: {
    get present() { return hasOwnPendingGlobal("__pendingEffectChoiceResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectChoiceResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectChoiceResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectChoiceResume; },
  },
  __pendingEffectChoiceSide: {
    get present() { return hasOwnPendingGlobal("__pendingEffectChoiceSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectChoiceSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectChoiceSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectChoiceSide; },
  },
  __pendingEffectOptionalBindings: {
    get present() { return hasOwnPendingGlobal("__pendingEffectOptionalBindings"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectOptionalBindings")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectOptionalBindings", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectOptionalBindings; },
  },
  __pendingEffectOptionalContinuation: {
    get present() { return hasOwnPendingGlobal("__pendingEffectOptionalContinuation"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectOptionalContinuation")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectOptionalContinuation", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectOptionalContinuation; },
  },
  __pendingEffectOptionalCostPaid: {
    get present() { return hasOwnPendingGlobal("__pendingEffectOptionalCostPaid"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectOptionalCostPaid")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectOptionalCostPaid", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectOptionalCostPaid; },
  },
  __pendingEffectOptionalResume: {
    get present() { return hasOwnPendingGlobal("__pendingEffectOptionalResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectOptionalResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectOptionalResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectOptionalResume; },
  },
  __pendingEffectOptionalSide: {
    get present() { return hasOwnPendingGlobal("__pendingEffectOptionalSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectOptionalSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectOptionalSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectOptionalSide; },
  },
  __pendingEffectPickQueue: {
    get present() { return hasOwnPendingGlobal("__pendingEffectPickQueue"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectPickQueue")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectPickQueue", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectPickQueue; },
  },
  __pendingEffectPickSide: {
    get present() { return hasOwnPendingGlobal("__pendingEffectPickSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectPickSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectPickSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectPickSide; },
  },
  __pendingEffectRepeatOptionalResume: {
    get present() { return hasOwnPendingGlobal("__pendingEffectRepeatOptionalResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectRepeatOptionalResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectRepeatOptionalResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectRepeatOptionalResume; },
  },
  __pendingEffectRepeatOptionalSide: {
    get present() { return hasOwnPendingGlobal("__pendingEffectRepeatOptionalSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingEffectRepeatOptionalSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingEffectRepeatOptionalSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingEffectRepeatOptionalSide; },
  },
  __pendingHirameki: {
    get present() { return hasOwnPendingGlobal("__pendingHirameki"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingHirameki")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingHirameki", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingHirameki; },
  },
  __pendingMisread: {
    get present() { return hasOwnPendingGlobal("__pendingMisread"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingMisread")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingMisread", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingMisread; },
  },
  __pendingPublicHandRevealSide: {
    get present() { return hasOwnPendingGlobal("__pendingPublicHandRevealSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingPublicHandRevealSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingPublicHandRevealSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingPublicHandRevealSide; },
  },
  __pendingRpsBindings: {
    get present() { return hasOwnPendingGlobal("__pendingRpsBindings"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingRpsBindings")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingRpsBindings", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingRpsBindings; },
  },
  __pendingRpsContinuation: {
    get present() { return hasOwnPendingGlobal("__pendingRpsContinuation"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingRpsContinuation")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingRpsContinuation", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingRpsContinuation; },
  },
  __pendingRpsResume: {
    get present() { return hasOwnPendingGlobal("__pendingRpsResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingRpsResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingRpsResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingRpsResume; },
  },
  __pendingRpsSide: {
    get present() { return hasOwnPendingGlobal("__pendingRpsSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingRpsSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingRpsSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingRpsSide; },
  },
  __pendingSetCardChoiceBindings: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardChoiceBindings"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardChoiceBindings")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardChoiceBindings", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardChoiceBindings; },
  },
  __pendingSetCardChoiceContinuation: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardChoiceContinuation"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardChoiceContinuation")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardChoiceContinuation", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardChoiceContinuation; },
  },
  __pendingSetCardChoiceGuard: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardChoiceGuard"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardChoiceGuard")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardChoiceGuard", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardChoiceGuard; },
  },
  __pendingSetCardChoiceResume: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardChoiceResume"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardChoiceResume")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardChoiceResume", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardChoiceResume; },
  },
  __pendingSetCardChoiceSide: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardChoiceSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardChoiceSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardChoiceSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardChoiceSide; },
  },
  __pendingSetCardReplacementSide: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardReplacementSide"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardReplacementSide")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardReplacementSide", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardReplacementSide; },
  },
  __pendingRuntimeStateMarker: {
    get present() { return hasOwnPendingGlobal("__pendingRuntimeStateMarker"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingRuntimeStateMarker")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingRuntimeStateMarker", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingRuntimeStateMarker; },
  },
};

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
    const present = access.present;
    const value = present ? access.value : undefined;
    return {
      key,
      present,
      value: key === '__pendingRuntimeStateMarker'
        ? value
        : toPlainDeep(value),
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
  const access = pendingGlobalAccess('__pendingRuntimeStateMarker');
  return access.present ? access.value as PendingRuntimeMarker : undefined;
}

function setMarker(value: PendingRuntimeMarker): void {
  const access = pendingGlobalAccess('__pendingRuntimeStateMarker');
  if (value === undefined) access.remove();
  else access.value = value;
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
