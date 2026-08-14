// qa: card:B04012:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01013 } from '@/cards/ct-p01/B01013';
import { B04012 } from '@/cards/ct-p04/B04012';
import { PR194 } from '@/cards/pr-01/PR194';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

function deployB04012() {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B04012.colors];
  state.players.self.file = Array.from(
    { length: B04012.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = [B04012.id];
  state.players.self.deck = [B01013.id, PR194.id];
  startCausalSession(state, 'qa-b04012-optional-decline');
  resetPresentationQueue('qa-b04012-optional-decline');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B04012.id })).toEqual({ ok: true });

  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    atomVerb: 'deckRevealUntil',
    nMin: 0,
    nMax: 1,
    source: { cardId: B04012.id },
  });
  expect(pending!.candidates.map(candidate => candidate.cardId)).toEqual([B01013.id]);
  return pending!;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B04012 optional acquisition', () => {
  it('declines an eligible top card and moves it behind the unrevealed decoy', () => {
    deployB04012();

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toEqual({ ok: true });
    const current = useGameStateStore.getState();
    expect(current.gameState!.players.self.hand).not.toContain(B01013.id);
    expect(current.gameState!.players.self.deck).toEqual([PR194.id, B01013.id]);
    expect(current.pendingEffectPick).toBeNull();
    expect(current.pendingDeckReveal).toMatchObject({ revealed: [B01013.id], matched: null });
    expect(current.pendingDeckReveal?.awaitingPick).not.toBe(true);
  });

  it('can acquire the same eligible card instead of always declining', () => {
    const pending = deployB04012();

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
    })).toEqual({ ok: true });
    const current = useGameStateStore.getState();
    expect(current.gameState!.players.self.hand).toContain(B01013.id);
    expect(current.gameState!.players.self.deck).toEqual([PR194.id]);
    expect(current.pendingEffectPick).toBeNull();
    expect(current.pendingDeckReveal).toMatchObject({ revealed: [B01013.id], matched: B01013.id });
    expect(current.pendingDeckReveal?.awaitingPick).not.toBe(true);
  });
});
