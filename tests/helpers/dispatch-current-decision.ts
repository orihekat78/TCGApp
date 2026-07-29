import { useGameStateStore } from '@/ui/state/store';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import {
  bindPendingDecision,
  type DecisionResponse,
  type DispatchResult,
  type EngineAction,
} from '@/ui/hooks/useEngineDispatch/types';

type StripDecisionId<Action> = Action extends DecisionResponse
  ? Omit<Action, keyof DecisionResponse>
  : never;

type UnboundDecisionAction = StripDecisionId<EngineAction>;

/**
 * Test-fixture adapter. Production consumers must bind the identity captured
 * by their rendered pending decision instead of reading the current store.
 */
export function dispatchCurrentDecision(
  action: UnboundDecisionAction,
): DispatchResult {
  const store = useGameStateStore.getState();
  const pending: DecisionResponse | null = (() => {
    switch (action.type) {
      case 'leaveInterceptResolve': return store.pendingLeaveIntercept;
      case 'rpsResolve': return store.pendingRps;
      case 'setCardChoiceResolve': return store.pendingSetCardChoice;
      case 'setCardReplacementResolve': return store.pendingSetCardReplacement;
      case 'hiramekiResolve': return store.pendingHirameki;
      case 'misreadResolve': return store.pendingMisread;
      case 'effectPickResolve': return store.pendingEffectPick;
      case 'choiceResolve': return store.pendingEffectChoice;
      case 'optionalResolve': return store.pendingEffectOptional;
      case 'chooseInterceptResolve': return store.pendingChooseIntercept;
      case 'repeatOptionalResolve': return store.pendingEffectRepeatOptional;
      case 'deckReorderResolve': return store.pendingDeckReorder;
      case 'deckPlaceResolve': return store.pendingDeckPlace;
    }
  })();
  if (!pending) {
    throw new Error(`No current pending decision for ${action.type}`);
  }
  return dispatchEngineAction(
    bindPendingDecision(pending, action) as EngineAction,
  );
}
