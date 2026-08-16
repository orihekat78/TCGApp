// qa: card:B10017:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10078:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10087:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10088:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10089:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10090:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10096:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10017 } from '@/cards/ct-p10/B10017';
import { B10078 } from '@/cards/ct-p10/B10078';
import { B10087 } from '@/cards/ct-p10/B10087';
import { B10088 } from '@/cards/ct-p10/B10088';
import { B10089 } from '@/cards/ct-p10/B10089';
import { B10090 } from '@/cards/ct-p10/B10090';
import { B10096 } from '@/cards/ct-p10/B10096';
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

const OWNER_CARD = 'CTP10_CUTIN_OWNER';
const ALT_OWNER_CARD = 'CTP10_CUTIN_ALT_OWNER';
const OTHER_CARD = 'CTP10_CUTIN_OTHER';
const OWNER_UID = 'ctp10-cutin-owner';
const OTHER_UID = 'ctp10-cutin-other';

function character(id: string, ap: number, names: string[], traits: string[]): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: [], level: 1, ap, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const OWNER_DEF = character(OWNER_CARD, 1000, ['ジン'], ['警察']);
const ALT_OWNER_DEF = character(ALT_OWNER_CARD, 1000, ['別人'], []);
const OTHER_DEF = character(OTHER_CARD, 5000, ['相手'], []);
const CARDS = [B10017, B10078, B10087, B10088, B10089, B10090, B10096] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function scenario(card: CardDef, owner: Player, turnPlayer: Player, ownerCardId = OWNER_CARD): GameState {
  const state = createEmptyGameState();
  const opponent = other(owner);
  const ownerIsActor = owner === turnPlayer;
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].hand = [card.id];
  state.players[owner].scene = [makeChar({
    cardId: ownerCardId,
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

function install(card: CardDef, owner: Player, turnPlayer: Player, ownerCardId = OWNER_CARD): void {
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  beginMatchSession(owner);
  expect(useGameStateStore.getState().setGameState(scenario(card, owner, turnPlayer, ownerCardId))).toBe(true);
}

function reachCutInStep(owner: Player, turnPlayer: Player): string {
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

type CutInProof = {
  dispatch: ReturnType<typeof dispatchEngineAction>;
  hand: string[];
  remove: string[];
  cutInUsed: boolean;
  ownerAp: number;
  openEffects: number;
};

function run(card: CardDef, owner: Player, turnPlayer: Player, ownerCardId = OWNER_CARD): CutInProof {
  install(card, owner, turnPlayer, ownerCardId);
  const actionId = reachCutInStep(owner, turnPlayer);
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
    openEffects: state.pendingEffects.filter(entry => entry.state !== 'resolved').length,
  };
}

function prove(card: CardDef, ownTurnAp: number, owner: Player = 'self') {
  return {
    ownTurn: run(card, owner, owner),
    opponentTurn: run(card, owner, other(owner)),
    expected: {
      ownTurn: {
        dispatch: { ok: true }, hand: [], remove: [card.id], cutInUsed: true,
        ownerAp: ownTurnAp, openEffects: 0,
      },
      opponentTurn: {
        dispatch: { ok: true }, hand: [], remove: [card.id], cutInUsed: true,
        ownerAp: 1000, openEffects: 0,
      },
    },
  };
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  for (const card of [...CARDS, OWNER_DEF, ALT_OWNER_DEF, OTHER_DEF]) register(card);
  registerTriggeredListener();
});

afterEach(() => endMatchSession());

describe('CT-P10 opponent-turn cut-in public authority', () => {
  it('card:B10017:f0267a26 uses the card but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10017, 4000);
    expect({ B10017: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10017: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('card:B10078:f0267a26 uses the Police cut-in but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10078, 3000);
    expect({ B10078: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10078: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('card:B10087:f0267a26 uses the card but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10087, 3000);
    expect({ B10087: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10087: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('card:B10088:f0267a26 uses the card but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10088, 2000);
    expect({ B10088: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10088: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('card:B10089:f0267a26 uses the card but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10089, 2000);
    expect({ B10089: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10089: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('card:B10090:f0267a26 uses the Gin cut-in but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10090, 4000);
    expect({ B10090: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10090: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('B10078 remains usable but has no AP text for a non-Police contact character', () => {
    expect(run(B10078, 'self', 'self', ALT_OWNER_CARD)).toMatchObject({
      dispatch: { ok: true }, hand: [], remove: [B10078.id], cutInUsed: true, ownerAp: 1000,
    });
  });

  it('B10090 applies only the base +1000 branch to a non-Gin contact character', () => {
    expect(run(B10090, 'self', 'self', ALT_OWNER_CARD)).toMatchObject({
      dispatch: { ok: true }, hand: [], remove: [B10090.id], cutInUsed: true, ownerAp: 2000,
    });
  });

  it('card:B10096:f0267a26 uses the card but suppresses AP text on the opponent turn', () => {
    const proof = prove(B10096, 4000);
    expect({ B10096: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10096: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });

  it('evaluates the turn condition relative to an opponent-owned B10017', () => {
    const proof = prove(B10017, 4000, 'opp');
    expect({ B10017: proof.ownTurn, opponentTurn: proof.opponentTurn }).toEqual({ B10017: proof.expected.ownTurn, opponentTurn: proof.expected.opponentTurn });
  });
});
