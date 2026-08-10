import type { GameStateStore } from './store.js';

type AutonomousDecisionSlice = Pick<
  GameStateStore,
  | 'pendingEffectPick'
  | 'pendingEffectChoice'
  | 'pendingEffectOptional'
  | 'pendingChooseIntercept'
  | 'pendingLeaveIntercept'
  | 'pendingSetCardChoice'
  | 'pendingSetCardReplacement'
  | 'pendingEffectRepeatOptional'
  | 'pendingHirameki'
  | 'pendingMisread'
  | 'pendingDeckReveal'
  | 'pendingPublicHandReveal'
  | 'pendingDeckReorder'
  | 'pendingDeckPlace'
  | 'pendingRps'
>;

/** One unresolved UI decision owns progression until its resolver clears it. */
export function selectAutonomousDecisionBlocked(state: AutonomousDecisionSlice): boolean {
  return Boolean(
    state.pendingEffectPick
    || state.pendingEffectChoice
    || state.pendingEffectOptional
    || state.pendingChooseIntercept
    || state.pendingLeaveIntercept
    || state.pendingSetCardChoice
    || state.pendingSetCardReplacement
    || state.pendingEffectRepeatOptional
    || state.pendingHirameki
    || state.pendingMisread
    || state.pendingDeckReveal
    || state.pendingPublicHandReveal?.lifetime === 'effect'
    || state.pendingDeckReorder
    || state.pendingDeckPlace
    || state.pendingRps
  );
}
