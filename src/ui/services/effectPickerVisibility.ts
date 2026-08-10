import type { GameState } from '@/engine/types/game-state.js';
import type { PendingEffectPick } from '@/ui/state/store.js';
import { isHumanDecisionOwner } from './humanDecisionOwner.js';
import { isSceneDirectPick } from './scenePick.js';

const AREA_PICK_VERBS = new Set([
  'evidenceToHand',
  'handAddFromRemove',
  'deckRevealUntil',
  'discard',
  'sceneRemove',
  'charModifyAP',
  'sceneEnter',
  'charStackCard',
]);

/** Single owner predicate for the required generic effect-picker dialog. */
export function shouldRenderEffectPicker(
  pending: PendingEffectPick | null | undefined,
  gameState: GameState | null | undefined,
  spectatorMode: boolean,
): boolean {
  if (!pending || !isHumanDecisionOwner(pending.player, spectatorMode)) return false;
  const isPublicOpponentHandDiscard = pending.atomVerb === 'discard'
    && pending.candidates.some((candidate) => candidate.player === 'opp');
  const hasLinkedPublicReveal = typeof pending.publicHandRevealToken === 'string';
  const usesSelfDirectAreaUi = pending.player === 'self'
    && AREA_PICK_VERBS.has(pending.atomVerb)
    && !isPublicOpponentHandDiscard
    && !hasLinkedPublicReveal;
  return !usesSelfDirectAreaUi && !isSceneDirectPick(pending, gameState);
}
