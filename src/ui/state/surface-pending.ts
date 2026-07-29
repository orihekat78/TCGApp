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

type GetStore = () => GameStateStore;
type PublicHandReveal = NonNullable<
  ReturnType<typeof _drainPendingPublicHandRevealSide>
>;

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
