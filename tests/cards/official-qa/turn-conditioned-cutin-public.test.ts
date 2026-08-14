// qa: card:B02007:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
// qa: card:B02024:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
// qa: card:B02042:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
// qa: card:B02059:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
// qa: card:B03123:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
// qa: card:B06059:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B02007 } from '@/cards/ct-p02/B02007';
import { B02024 } from '@/cards/ct-p02/B02024';
import { B02024P } from '@/cards/ct-p02/B02024P';
import { B02042 } from '@/cards/ct-p02/B02042';
import { B02042P } from '@/cards/ct-p02/B02042P';
import { B02059 } from '@/cards/ct-p02/B02059';
import { B02059P } from '@/cards/ct-p02/B02059P';
import { B03123 } from '@/cards/ct-p03/B03123';
import { B03123P } from '@/cards/ct-p03/B03123P';
import { B06059 } from '@/cards/ct-p06/B06059';
import { PR052 } from '@/cards/pr-01/PR052';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const OWNER_CARD = 'TURN_CUTIN_OWNER';
const OTHER_CARD = 'TURN_CUTIN_OTHER';
const OWNER_UID = 'turn-cutin-owner';
const OTHER_UID = 'turn-cutin-other';

const QA_SUFFIX = 'e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c';
const PRIMARY_CARDS = [B02007, B02024, B02042, B02059, B03123, B06059] as const;
const ALIASES = [B02024P, B02042P, B02059P, B03123P, PR052] as const;

function character(id: string, ap: number): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: [],
    level: 1,
    ap,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const OWNER_DEF = character(OWNER_CARD, 1000);
const OTHER_DEF = character(OTHER_CARD, 5000);

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function scenarioState(card: CardDef, owner: Player, turnPlayer: Player, copies = 1): GameState {
  const state = createEmptyGameState();
  const opponent = other(owner);
  const ownerIsActor = owner === turnPlayer;
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].hand = Array.from({ length: copies }, () => card.id);
  state.players.self.deck = [OWNER_CARD, OTHER_CARD];
  state.players.opp.deck = [OTHER_CARD, OWNER_CARD];
  state.players[owner].scene = [makeChar({
    cardId: OWNER_CARD,
    uid: OWNER_UID,
    state: ownerIsActor ? 'active' : 'sleep',
  })];
  state.players[opponent].scene = [makeChar({
    cardId: OTHER_CARD,
    uid: OTHER_UID,
    state: ownerIsActor ? 'sleep' : 'active',
  })];
  return state;
}

function currentState(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function installScenario(card: CardDef, owner: Player, turnPlayer: Player, copies = 1): void {
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  beginMatchSession(owner);
  expect(useGameStateStore.getState().setGameState(scenarioState(card, owner, turnPlayer, copies)))
    .toBe(true);
}

function reachOwnerContactStep(owner: Player, turnPlayer: Player): string {
  const ownerIsActor = owner === turnPlayer;
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: ownerIsActor ? OWNER_UID : OTHER_UID,
    targetUid: ownerIsActor ? OTHER_UID : OWNER_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(flow.action._getContext(currentState(), actionId!)).toMatchObject({
    phase: 'action-1',
    firstUid: OWNER_UID,
  });
  return actionId!;
}

type ScenarioProof = {
  dispatch: ReturnType<typeof dispatchEngineAction>;
  hand: string[];
  remove: string[];
  cutInUsed: boolean;
  ownerAp: number;
  otherAp: number;
  openEffects: number;
};

function runCutIn(card: CardDef, owner: Player, turnPlayer: Player, copies = 1): ScenarioProof {
  installScenario(card, owner, turnPlayer, copies);
  const actionId = reachOwnerContactStep(owner, turnPlayer);
  const dispatch = dispatchEngineAction({
    type: 'actionContact',
    actionId,
    player: owner,
    choice: { kind: 'cutin', cardId: card.id },
  });
  const state = currentState();
  return {
    dispatch,
    hand: [...state.players[owner].hand],
    remove: [...state.players[owner].remove],
    cutInUsed: flow.action._getContext(state, actionId)?.cutInUsed?.[owner] === true,
    ownerAp: readChar.ap(state, OWNER_UID),
    otherAp: readChar.ap(state, OTHER_UID),
    openEffects: state.pendingEffects.filter(entry => entry.state !== 'resolved').length,
  };
}

function proveTurnCondition(card: CardDef, owner: Player = 'self') {
  const used: Array<{ player: Player; cardId: string }> = [];
  event.on('cutin:used', (_state, payload) => {
    used.push(payload as { player: Player; cardId: string });
  });
  return {
    onTurn: runCutIn(card, owner, owner),
    offTurn: runCutIn(card, owner, other(owner)),
    used,
  };
}

const expectedProof = (cardId: string, owner: Player = 'self') => ({
  onTurn: {
    dispatch: { ok: true },
    hand: [],
    remove: [cardId],
    cutInUsed: true,
    ownerAp: 4000,
    otherAp: 5000,
    openEffects: 0,
  },
  offTurn: {
    dispatch: { ok: true },
    hand: [],
    remove: [cardId],
    cutInUsed: true,
    ownerAp: 1000,
    otherAp: 5000,
    openEffects: 0,
  },
  used: [
    { player: owner, cardId },
    { player: owner, cardId },
  ],
});

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  for (const card of [...PRIMARY_CARDS, ...ALIASES, OWNER_DEF, OTHER_DEF]) {
    register(card);
  }
  registerTriggeredListener();
});

afterEach(() => endMatchSession());

describe('turn-conditioned cut-in public authority', () => {
  it(`card:B02007:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B02007)).toEqual(expectedProof(B02007.id));
  });

  it(`card:B02024:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B02024)).toEqual(expectedProof(B02024.id));
  });

  it(`card:B02042:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B02042)).toEqual(expectedProof(B02042.id));
  });

  it(`card:B02059:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B02059)).toEqual(expectedProof(B02059.id));
  });

  it(`card:B03123:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B03123)).toEqual(expectedProof(B03123.id));
  });

  it(`card:B06059:${QA_SUFFIX}: use is legal while AP text is turn-conditioned`, () => {
    expect(proveTurnCondition(B06059)).toEqual(expectedProof(B06059.id));
  });

  it.each(ALIASES)('$id preserves the same printed turn-relative contract', card => {
    expect(proveTurnCondition(card)).toEqual(expectedProof(card.id));
  });

  it('interprets self turn relative to an opponent-owned cut-in card', () => {
    expect(proveTurnCondition(B02007, 'opp')).toEqual(expectedProof(B02007.id, 'opp'));
  });

  it('passes without consuming the card, allowance, or AP', () => {
    installScenario(B02007, 'self', 'self');
    const actionId = reachOwnerContactStep('self', 'self');

    expect(dispatchEngineAction({
      type: 'actionContact',
      actionId,
      player: 'self',
      choice: { kind: 'pass' },
    })).toEqual({ ok: true });
    expect({
      hand: currentState().players.self.hand,
      remove: currentState().players.self.remove,
      cutInUsed: flow.action._getContext(currentState(), actionId)?.cutInUsed?.self === true,
      ownerAp: readChar.ap(currentState(), OWNER_UID),
    }).toEqual({ hand: [B02007.id], remove: [], cutInUsed: false, ownerAp: 1000 });
  });

  it('rejects a second cut-in after the public allowance was consumed', () => {
    installScenario(B02007, 'self', 'self', 2);
    const actionId = reachOwnerContactStep('self', 'self');
    const choice = {
      type: 'actionContact' as const,
      actionId,
      player: 'self' as const,
      choice: { kind: 'cutin' as const, cardId: B02007.id },
    };

    expect(dispatchEngineAction(choice)).toEqual({ ok: true });
    const afterFirst = currentState();
    expect(dispatchEngineAction(choice)).toEqual({ ok: false, reason: 'not-allowed' });
    expect({
      hand: currentState().players.self.hand,
      remove: currentState().players.self.remove,
      ownerAp: readChar.ap(currentState(), OWNER_UID),
      actionContext: flow.action._getContext(currentState(), actionId),
    }).toEqual({
      hand: afterFirst.players.self.hand,
      remove: afterFirst.players.self.remove,
      ownerAp: readChar.ap(afterFirst, OWNER_UID),
      actionContext: flow.action._getContext(afterFirst, actionId),
    });
  });
});
