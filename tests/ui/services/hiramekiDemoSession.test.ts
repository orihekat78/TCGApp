import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { flow } from '@/engine';
import { registerAll } from '@/cards';
import { registerHiramekiListener } from '@/engine/listeners/hirameki';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { currentPresentationSessionId } from '@/ui/presentation/coordinator';
import { endMatchSession } from '@/ui/services/matchSession';
import { startHiramekiDemoSession } from '@/ui/services/hiramekiDemoSession';
import { useGameStateStore } from '@/ui/state/store';

describe('startHiramekiDemoSession', () => {
  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
  });

  afterEach(() => {
    endMatchSession();
  });

  it.each(['fire', 'skip'] as const)(
    'runs the public demo through a state-owned causal checkpoint (%s)',
    (choice) => {
      expect(startHiramekiDemoSession('B04028')).toEqual({ ok: true });

      const pending = useGameStateStore.getState().pendingHirameki;
      const state = useGameStateStore.getState().gameState!;
      const actionId = useGameStateStore.getState().activeActionId!;
      expect(pending).toMatchObject({
        actionId,
        player: 'self',
        cardId: 'B04028',
        abilityId: 'a2',
        gainDeferred: true,
        occurrence: expect.any(Object),
        causalCorrelationEventId: expect.any(String),
      });
      expect(flow.action._getContext(state, actionId)).toMatchObject({
        phase: 'judge',
        judgeResolved: true,
        deferredCaseEvidenceGain: true,
      });
      expect(useGameStateStore.getState()).toMatchObject({
        hiramekiDemoMode: 'playing',
        hiramekiDemoSelectedCardId: 'B04028',
      });
      expect(state.causalLog?.sessionId).toBe(currentPresentationSessionId());

      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'hiramekiResolve',
        choice,
      }))).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });

      const after = useGameStateStore.getState().gameState!;
      expect(flow.action._getContext(after, actionId)).toBeUndefined();
      expect(after.players.self.evidence).toHaveLength(choice === 'fire' ? 1 : 0);
      expect(after.players.opp.evidence).toHaveLength(1);
    },
  );
});
