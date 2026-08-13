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
import {
  assertPendingDeclaredNameAuthority,
  assertPendingRuntimeValue,
} from './pending-runtime-schema.js';
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
  __pendingSetCardReplacementGuard: {
    get present() { return hasOwnPendingGlobal("__pendingSetCardReplacementGuard"); },
    get value() { return Object.getOwnPropertyDescriptor(pendingGlobals, "__pendingSetCardReplacementGuard")?.value; },
    set value(value) { Object.defineProperty(pendingGlobals, "__pendingSetCardReplacementGuard", ownPendingData(value)); },
    remove() { delete pendingGlobals.__pendingSetCardReplacementGuard; },
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
    if (present) {
      assertPendingRuntimeValue(key, value, { allowMarker: true, mode: 'live' });
    }
    return {
      key,
      present,
      value: key === '__pendingRuntimeStateMarker'
        ? value
        : toPlainDeep(value),
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
      if (options.persisted === true) {
        throw new Error(`Invalid pending runtime snapshot key at index ${index}`);
      }
      throw new Error(`unknown pending runtime key: ${String(entry.key)}`);
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
  const entries = validated.map((entry) => ({
    entry,
    access: pendingGlobalAccess(entry.key),
  }));
  for (const { entry, access } of entries) {
    if (entry.present) {
      access.value = entry.value;
    }
    else access.remove();
  }
}

function assertPendingRuntimeMatchesState(
  state: GameState,
  snapshot: ReadonlyArray<{ key: PendingKey; present: boolean; value: unknown }>,
): void {
  for (const entry of snapshot) {
    if (entry.present && entry.key !== '__pendingRuntimeStateMarker') {
      assertPendingDeclaredNameAuthority(state, entry.value, entry.key);
    }
  }
  const deckPlace = snapshot.find(entry => entry.key === '__pendingDeckPlaceSide' && entry.present);
  if (deckPlace && deckPlace.value !== null) {
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
  for (const key of TRANSACTIONAL_PENDING_KEYS) pendingGlobalAccess(key).remove();
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
