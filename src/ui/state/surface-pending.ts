import {
  _drainPendingHirameki,
  _drainPendingMisread,
} from '@/engine';
import {
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  _peekPendingEffectChoiceSide,
  _peekPendingEffectPickSide,
} from '@/engine/effect/resolve-picks';
import {
  _drainPendingChooseInterceptSide,
  _drainPendingEffectRepeatOptionalSide,
  _drainPendingRpsSide,
  _drainPendingSetCardChoiceSide,
  _drainPendingSetCardReplacementSide,
} from '@/engine/effect/pending-state.js';
import {
  _drainPendingDeckPlaceSide,
  _drainPendingDeckReorderSide,
  _drainPendingDeckRevealSide,
  _drainPendingPublicHandRevealSide,
} from '@/engine/effect/atom-handlers';
import type { GameStateStore } from './store.js';

export type PendingSurfaceState = Pick<GameStateStore,
  | 'pendingDecisionSeq'
  | 'pendingHirameki'
  | 'pendingMisread'
  | 'pendingEffectPick'
  | 'pendingEffectChoice'
  | 'pendingEffectOptional'
  | 'pendingChooseIntercept'
  | 'pendingLeaveIntercept'
  | 'pendingRps'
  | 'pendingSetCardChoice'
  | 'pendingSetCardReplacement'
  | 'pendingEffectRepeatOptional'
  | 'pendingDeckReveal'
  | 'pendingPublicHandReveal'
  | 'pendingDeckReorder'
  | 'pendingDeckPlace'
>;

type PendingSurfaceStore = PendingSurfaceState & Pick<GameStateStore,
  | 'setPendingHirameki'
  | 'setPendingMisread'
  | 'setPendingEffectPick'
  | 'setPendingEffectChoice'
  | 'setPendingEffectOptional'
  | 'setPendingChooseIntercept'
  | 'setPendingRps'
  | 'setPendingSetCardChoice'
  | 'setPendingSetCardReplacement'
  | 'setPendingEffectRepeatOptional'
  | 'setPendingDeckReveal'
  | 'setPendingPublicHandReveal'
  | 'setPendingDeckReorder'
  | 'setPendingDeckPlace'
>;

type GetStore = () => PendingSurfaceStore;
type PublicHandReveal = NonNullable<
  ReturnType<typeof _drainPendingPublicHandRevealSide>
>;

type PendingDecisionSurfaceKey =
  | 'pendingHirameki'
  | 'pendingMisread'
  | 'pendingEffectPick'
  | 'pendingEffectChoice'
  | 'pendingEffectOptional'
  | 'pendingChooseIntercept'
  | 'pendingRps'
  | 'pendingSetCardChoice'
  | 'pendingSetCardReplacement'
  | 'pendingEffectRepeatOptional'
  | 'pendingDeckReorder'
  | 'pendingDeckPlace';

/** Drain pending runtime channels into a detached state before publishing it. */
export function collectPendingSideChannels(seed: PendingSurfaceState): PendingSurfaceState {
  function setDecision(key: PendingDecisionSurfaceKey, pending: object | null): void {
    if (pending === null) {
      Object.assign(collector, { [key]: null });
      return;
    }
    const next = collector.pendingDecisionSeq + 1;
    Object.assign(collector, {
      [key]: { ...pending, decisionId: `decision:${next}` },
      pendingDecisionSeq: next,
    });
  }
  const collector: PendingSurfaceStore = {
    ...seed,
    setPendingHirameki: (pending) => setDecision('pendingHirameki', pending),
    setPendingMisread: (pending) => setDecision('pendingMisread', pending),
    setPendingEffectPick: (pending) => setDecision('pendingEffectPick', pending),
    setPendingEffectChoice: (pending) => setDecision('pendingEffectChoice', pending),
    setPendingEffectOptional: (pending) => setDecision('pendingEffectOptional', pending),
    setPendingChooseIntercept: (pending) => setDecision('pendingChooseIntercept', pending),
    setPendingRps: (pending) => setDecision('pendingRps', pending),
    setPendingSetCardChoice: (pending) => setDecision('pendingSetCardChoice', pending),
    setPendingSetCardReplacement: (pending) => setDecision('pendingSetCardReplacement', pending),
    setPendingEffectRepeatOptional: (pending) =>
      setDecision('pendingEffectRepeatOptional', pending),
    setPendingDeckReveal: (pending) => { collector.pendingDeckReveal = pending; },
    setPendingPublicHandReveal: (pending) => { collector.pendingPublicHandReveal = pending; },
    setPendingDeckReorder: (pending) => setDecision('pendingDeckReorder', pending),
    setPendingDeckPlace: (pending) => setDecision('pendingDeckPlace', pending),
  };

  surfacePendingSideChannels(() => collector);
  return {
    pendingDecisionSeq: collector.pendingDecisionSeq,
    pendingHirameki: collector.pendingHirameki,
    pendingMisread: collector.pendingMisread,
    pendingEffectPick: collector.pendingEffectPick,
    pendingEffectChoice: collector.pendingEffectChoice,
    pendingEffectOptional: collector.pendingEffectOptional,
    pendingChooseIntercept: collector.pendingChooseIntercept,
    pendingLeaveIntercept: collector.pendingLeaveIntercept,
    pendingRps: collector.pendingRps,
    pendingSetCardChoice: collector.pendingSetCardChoice,
    pendingSetCardReplacement: collector.pendingSetCardReplacement,
    pendingEffectRepeatOptional: collector.pendingEffectRepeatOptional,
    pendingDeckReveal: collector.pendingDeckReveal,
    pendingPublicHandReveal: collector.pendingPublicHandReveal,
    pendingDeckReorder: collector.pendingDeckReorder,
    pendingDeckPlace: collector.pendingDeckPlace,
  };
}

export function hasLinkedPublicHandRevealDecision(
  getStore: GetStore,
  token: string,
): boolean {
  const state = getStore();
  return state.pendingEffectPick?.publicHandRevealToken === token
    || state.pendingEffectChoice?.publicHandRevealToken === token
    || state.pendingEffectOptional?.publicHandRevealToken === token
    || state.pendingChooseIntercept?.publicHandRevealToken === token;
}

export function surfacePublicHandReveal(
  getStore: GetStore,
  reveal: PublicHandReveal,
): void {
  if (reveal.lifetime === 'effect'
    && !hasLinkedPublicHandRevealDecision(getStore, reveal.resolutionToken)) return;
  getStore().setPendingPublicHandReveal(reveal);
}

/** Move restored or newly-paused engine decisions into public UI state. */
export function surfacePendingSideChannels(getStore: GetStore): void {
  let store = getStore();
  if (store.pendingHirameki === null) {
    const side = _drainPendingHirameki();
    if (side) store.setPendingHirameki(side);
  }
  store = getStore();
  if (store.pendingMisread === null) {
    const side = _drainPendingMisread();
    if (side) store.setPendingMisread(side);
  }

  store = getStore();
  const effectPick = _peekPendingEffectPickSide();
  const humanSide = (globalThis as {
    __humanPlayerSide?: 'self' | 'opp' | null;
  }).__humanPlayerSide ?? null;
  if (store.pendingEffectPick === null
    && effectPick !== null
    && (humanSide === null || effectPick.player === humanSide)) {
    const side = _drainPendingEffectPickSide();
    if (side) store.setPendingEffectPick(side);
  }

  store = getStore();
  const effectChoice = _peekPendingEffectChoiceSide();
  if (store.pendingEffectChoice === null
    && effectChoice !== null
    && (humanSide === null || effectChoice.player === humanSide)) {
    const side = _drainPendingEffectChoiceSide();
    if (side) store.setPendingEffectChoice(side);
  }

  store = getStore();
  if (store.pendingEffectOptional === null) {
    const side = _drainPendingEffectOptionalSide();
    if (side) store.setPendingEffectOptional(side);
  }
  store = getStore();
  if (store.pendingRps === null) {
    const side = _drainPendingRpsSide();
    if (side) store.setPendingRps(side);
  }
  store = getStore();
  if (store.pendingSetCardChoice === null) {
    const side = _drainPendingSetCardChoiceSide();
    if (side) store.setPendingSetCardChoice(side);
  }
  store = getStore();
  if (store.pendingSetCardReplacement === null) {
    const side = _drainPendingSetCardReplacementSide();
    if (side) store.setPendingSetCardReplacement(side);
  }
  store = getStore();
  if (store.pendingChooseIntercept === null) {
    const side = _drainPendingChooseInterceptSide();
    if (side) store.setPendingChooseIntercept(side);
  }
  store = getStore();
  if (store.pendingEffectRepeatOptional === null) {
    const side = _drainPendingEffectRepeatOptionalSide();
    if (side) store.setPendingEffectRepeatOptional(side);
  }
  store = getStore();
  if (store.pendingDeckReveal === null) {
    const side = _drainPendingDeckRevealSide();
    if (side) store.setPendingDeckReveal(side);
  }
  store = getStore();
  if (store.pendingPublicHandReveal === null) {
    const side = _drainPendingPublicHandRevealSide();
    if (side) surfacePublicHandReveal(getStore, side);
  }
  store = getStore();
  if (store.pendingDeckReorder === null) {
    const side = _drainPendingDeckReorderSide();
    if (side) store.setPendingDeckReorder(side);
  }
  store = getStore();
  if (store.pendingDeckPlace === null) {
    const side = _drainPendingDeckPlaceSide();
    if (side) store.setPendingDeckPlace(side);
  }
}
