import { startCausalSession } from '@/engine/log/causal';
import { createHiramekiDemoState, HIRAMEKI_DEMO_OPP_ATTACKER_UID } from '@/ui/fixtures/hiramekiDemoState';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import type { DispatchResult } from '@/ui/hooks/useEngineDispatch/types';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  matchSessionId,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

function abortDemo(result: DispatchResult): DispatchResult {
  endMatchSession();
  return result;
}

/** Start the public Hirameki demo through the same state-owned action FSM as live play. */
export function startHiramekiDemoSession(cardId: string): DispatchResult {
  const session = beginMatchSession('self');
  const state = createHiramekiDemoState(cardId);
  startCausalSession(state, matchSessionId(session));
  if (!commitMatchSession(session, state)) {
    return abortDemo({ ok: false, reason: 'engine-error', detail: 'stale demo session' });
  }

  const declared = dispatchEngineAction({
    type: 'actionDeclareCase',
    byUid: HIRAMEKI_DEMO_OPP_ATTACKER_UID,
    targetPlayer: 'self',
  });
  if (!declared.ok) return abortDemo(declared);

  const actionId = useGameStateStore.getState().activeActionId;
  if (actionId === null) {
    return abortDemo({ ok: false, reason: 'engine-error', detail: 'missing demo action context' });
  }

  const guard = dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null });
  if (!guard.ok) return abortDemo(guard);
  const judged = dispatchEngineAction({ type: 'actionJudge', actionId });
  if (!judged.ok) return abortDemo(judged);

  const store = useGameStateStore.getState();
  store.setHiramekiDemoSelectedCardId(cardId);
  store.setHiramekiDemoMode('playing');
  return judged;
}
