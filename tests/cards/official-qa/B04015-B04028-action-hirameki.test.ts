// qa: card:B04015:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:B04028:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B04015 } from '@/cards/ct-p04/B04015';
import { B04028 } from '@/cards/ct-p04/B04028';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D03016 } from '@/cards/ct-d03/D03016';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

const CASES = [
  {
    card: B04015,
    qaId: 'card:B04015:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c',
  },
  {
    card: B04028,
    qaId: 'card:B04028:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c',
  },
] as const;

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  [B04015, B04028, B10022, D03016].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  useGameStateStore.setState({ gameState: null, pendingHirameki: null });
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

function resolveCaseAction(card: CardDef, faceUp: boolean): void {
  const state = createEmptyGameState();
  state.turn = { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [sceneChar(B10022.id, 'attacker')];
  state.players.opp.deck = ['ACTION-GAIN'];
  state.players.self.case.cardId = D03016.id;
  state.players.self.evidence = [{ cardId: card.id, faceUp, origin: { turn: 0, via: 'opening' } }];
  state.players.self.deck = ['DRAWN'];
  const sessionId = `wave10-${card.id}-${faceUp}`;
  startCausalSession(state, sessionId);
  resetPresentationQueue(sessionId);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);

  expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: 'self' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

describe.each(CASES)('$qaId', ({ card }) => {
  it.each([true, false])('opens the optional Hirameki from the public action path (faceUp=%s)', (faceUp) => {
    resolveCaseAction(card, faceUp);

    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: 'self',
      cardId: card.id,
      abilityId: 'a2',
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.evidence).toEqual([
      expect.objectContaining({ cardId: 'DRAWN', faceUp: false }),
    ]);
  });
});
