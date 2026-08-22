// Rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const HOST = 'QA_W34_INTERCEPT_HOST';
const EVENT = 'QA_W34_INTERCEPT_EVENT';
const DRAW = 'QA_W34_INTERCEPT_DRAW';
const TAIL = 'QA_W34_INTERCEPT_TAIL';

function character(id: string, names = [id]): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['赤'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const EVENT_EFFECT: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: {
    hook: 'effect:declared', selfOnly: true,
    matcher: (payload: unknown) => (payload as { kind?: unknown }).kind === 'event-use',
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom', verb: 'sceneSetState', args: {
          player: 'opp', uid: '$pick', state: 'sleep',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'opp', filter: { cardName: 'Wave 34 Host' } },
            n: { min: 1, max: 1 }, chooser: 'opp',
          },
        },
      },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
};

const OPP_EVENT: CardDef = {
  ...character(EVENT), kind: 'event', colors: ['青'], level: 0, ap: 0, lp: 0,
  abilities: [EVENT_EFFECT],
};

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 8, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.case.colors = ['青'];
  state.players.opp.hand = [EVENT];
  state.players.opp.deck = [DRAW, TAIL];
  state.players.self.scene = [makeChar({
    uid: 'host', cardId: HOST,
    setCards: [
      { cardId: B02067.id, faceUp: true, instanceId: 'set-b02067' },
      { cardId: B02067P.id, faceUp: true, instanceId: 'set-b02067p' },
    ],
  })];
  return state;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(state = base()): void {
  endMatchSession();
  beginMatchSession('opp');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function startPublicEventSelection(): any {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: EVENT })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.map((candidate) => candidate.uid)).toContain('host');
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'host',
  }))).toEqual({ ok: true });
  return useGameStateStore.getState().pendingChooseIntercept;
}

function responseOccurrences(side: any): string[] {
  const responses = side.kind === 'order' ? side.choices : [side];
  return responses.map((response: any) => response.protector.setCardInstanceId);
}

function mutateEveryPersistedResponse(state: GameState, mutate: (response: any) => void): void {
  const snapshot = state.pendingRuntimeState!.snapshot as Array<{ key: string; value?: any }>;
  const side = snapshot.find((entry) => entry.key === '__pendingChooseInterceptSide')!.value;
  const resume = snapshot.find((entry) => entry.key === '__pendingChooseInterceptResume')!.value;
  const visitSide = (value: any): void => {
    if (value.kind === 'order') value.choices.forEach(mutate);
    else mutate(value);
  };
  visitSide(side);
  visitSide(resume.guard);
  resume.remainingGuards.forEach(mutate);
  for (const char of state.players.self.scene) {
    const witnesses = char.turnEffects.chooseInterceptBatchWitnesses as Array<{ response: any }> | undefined;
    witnesses?.forEach((witness) => mutate(witness.response));
  }
}

function expectNoChooseInterceptWitnesses(state: GameState): void {
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      expect(char.turnEffects.chooseInterceptBatchWitnesses).toBeUndefined();
    }
  }
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B02067, B02067P, character(HOST, ['Wave 34 Host']), OPP_EVENT, character(DRAW), character(TAIL)]
    .forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B02067 physical set-card interception public dispatch', () => {
  it('keeps two set occurrences distinct through JSON restore and cancels an opponent event exactly once', () => {
    install();
    const order = startPublicEventSelection();
    expect(order).toMatchObject({ kind: 'order', player: 'self' });
    expect(responseOccurrences(order)).toEqual(['set-b02067', 'set-b02067p']);

    const restored = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    const restoredOrder = useGameStateStore.getState().pendingChooseIntercept as any;
    expect(responseOccurrences(restoredOrder)).toEqual(['set-b02067', 'set-b02067p']);

    expect(dispatchEngineAction(bindPendingDecision(restoredOrder, {
      type: 'chooseInterceptOrderResolve',
      protectorUid: 'host', targetUid: 'host', setCardInstanceId: 'forged',
    } as any))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction(bindPendingDecision(restoredOrder, {
      type: 'chooseInterceptOrderResolve',
      protectorUid: 'host', targetUid: 'host', setCardInstanceId: 'set-b02067p',
    } as any))).toEqual({ ok: true });

    const after = current();
    expect(after.players.self.scene[0]?.state).toBe('active');
    expect(after.players.opp.deck).toEqual([DRAW, TAIL]);
    expect(after.players.opp.remove).toContain(EVENT);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(after.pendingRuntimeState).toBeUndefined();
    expectNoChooseInterceptWitnesses(after);
  });

  it.each(['missing', 'different'] as const)(
    'transactionally rejects a %s set-card instance in persisted pending authority',
    (variant) => {
      install();
      const liveOrder = startPublicEventSelection();
      expect(liveOrder).toMatchObject({ kind: 'order' });
      const liveState = current();

      const forged = JSON.parse(JSON.stringify(liveState)) as GameState;
      mutateEveryPersistedResponse(forged, (response) => {
        if (variant === 'missing') delete response.protector.setCardInstanceId;
        else response.protector.setCardInstanceId = 'set-forged';
      });
      expect(() => useGameStateStore.getState().setGameState(forged))
        .toThrow(/Invalid pendingChooseIntercept/);
      expect(useGameStateStore.getState().gameState).toBe(liveState);
      expect(useGameStateStore.getState().pendingChooseIntercept).toBe(liveOrder);
    },
  );
});
