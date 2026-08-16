// qa: card:B08085:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B08086:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:B10091:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:PR158:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7
// qa: card:PR164:f0267a26d9c5011ae2c2e4b82bf4f98a99ce33c5a2f747b8baacbca69be222c7

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B08085 } from '@/cards/ct-p08/B08085';
import { B08086 } from '@/cards/ct-p08/B08086';
import { B10091 } from '@/cards/ct-p10/B10091';
import { PR158 } from '@/cards/pr-01/PR158';
import { PR164 } from '@/cards/pr-01/PR164';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const BLACK_ACTOR = 'F026_BLACK_ACTOR';
const BLACK_LEVEL7_ACTOR = 'F026_BLACK_LEVEL7_ACTOR';
const BLACK_NO_CUTIN_ACTOR = 'F026_BLACK_NO_CUTIN_ACTOR';
const RED_ACTOR = 'F026_RED_ACTOR';
const OTHER_CARD = 'F026_OTHER';
const FILLER_CARD = 'F026_FILLER';
const BLACK_PARTNER = 'F026_BLACK_PARTNER';
const RED_PARTNER = 'F026_RED_PARTNER';
const ACTOR_UID = 'f026-actor';
const OTHER_UID = 'f026-other';

const CUTIN: AbilityDef = {
  id: 'cutin',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 0, scope: 'contact' } },
  description: '【カットイン】AP＋0。',
  ruleRefs: ['rules/09-cutin-disguise.md'],
};

function character(
  id: string,
  colors: string[],
  level: number,
  ap: number,
  abilities: AbilityDef[] = [],
): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors, level, ap, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [],
  };
}

function partner(id: string, color: string): CardDef {
  return {
    id, no: id, kind: 'partner', names: [id], colors: [color], level: 0,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const BLACK_ACTOR_DEF = character(BLACK_ACTOR, ['黒'], 8, 1000, [CUTIN]);
const BLACK_LEVEL7_ACTOR_DEF = character(BLACK_LEVEL7_ACTOR, ['黒'], 7, 1000, [CUTIN]);
const BLACK_NO_CUTIN_ACTOR_DEF = character(BLACK_NO_CUTIN_ACTOR, ['黒'], 8, 1000);
const RED_ACTOR_DEF = character(RED_ACTOR, ['赤'], 8, 1000, [CUTIN]);
const OTHER_DEF = character(OTHER_CARD, [], 1, 5000);
const FILLER_DEF = character(FILLER_CARD, [], 1, 1000);
const BLACK_PARTNER_DEF = partner(BLACK_PARTNER, '黒');
const RED_PARTNER_DEF = partner(RED_PARTNER, '赤');
const QA_CARDS = [B08085, B08086, B10091, PR158, PR164] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

type ScenarioOptions = {
  owner?: Player;
  turnPlayer?: Player;
  actorCardId?: string;
  partnerCardId?: string;
  fullScene?: boolean;
  ownerRemove?: string[];
  opponentRemove?: string[];
};

function scenario(card: CardDef, options: ScenarioOptions = {}): GameState {
  const owner = options.owner ?? 'self';
  const opponent = other(owner);
  const turnPlayer = options.turnPlayer ?? owner;
  const actorCardId = options.actorCardId ?? BLACK_ACTOR;
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = {
    cardId: options.partnerCardId ?? RED_PARTNER,
    state: 'active',
  };
  state.players[owner].hand = [card.id];
  state.players[owner].remove = [...(options.ownerRemove ?? [])];
  state.players[opponent].remove = [...(options.opponentRemove ?? [])];
  state.players[owner].scene = [makeChar({
    cardId: actorCardId,
    uid: ACTOR_UID,
    state: owner === turnPlayer ? 'active' : 'sleep',
  })];
  if (options.fullScene) {
    for (let index = 1; index <= 4; index += 1) {
      state.players[owner].scene.push(makeChar({
        cardId: FILLER_CARD,
        uid: `f026-filler-${index}`,
      }));
    }
  }
  state.players[opponent].scene = [makeChar({
    cardId: OTHER_CARD,
    uid: OTHER_UID,
    state: owner === turnPlayer ? 'sleep' : 'active',
  })];
  return state;
}

function currentState(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(card: CardDef, options: ScenarioOptions): { owner: Player; turnPlayer: Player } {
  const owner = options.owner ?? 'self';
  const turnPlayer = options.turnPlayer ?? owner;
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  beginMatchSession(owner);
  expect(useGameStateStore.getState().setGameState(scenario(card, options))).toBe(true);
  return { owner, turnPlayer };
}

function reachCutInStep(owner: Player, turnPlayer: Player): string {
  const ownerIsActor = owner === turnPlayer;
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: ownerIsActor ? ACTOR_UID : OTHER_UID,
    targetUid: ownerIsActor ? OTHER_UID : ACTOR_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(flow.action._getContext(currentState(), actionId!)).toMatchObject({
    phase: 'action-1',
    firstUid: ACTOR_UID,
  });
  return actionId!;
}

type ContactSnapshot = {
  dispatch: ReturnType<typeof dispatchEngineAction>;
  actionId: string;
  owner: Player;
  hand: string[];
  remove: string[];
  sceneIds: string[];
  actorAp: number;
  cutInUsed: boolean;
  openEffects: number;
};

function runCutIn(card: CardDef, options: ScenarioOptions = {}): ContactSnapshot {
  const { owner, turnPlayer } = install(card, options);
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
    actionId,
    owner,
    hand: [...state.players[owner].hand],
    remove: [...state.players[owner].remove],
    sceneIds: state.players[owner].scene.map(entry => entry.cardId),
    actorAp: readChar.ap(state, ACTOR_UID),
    cutInUsed: flow.action._getContext(state, actionId)?.cutInUsed?.[owner] === true,
    openEffects: state.pendingEffects.filter(entry => entry.state !== 'resolved').length,
  };
}

function expectUsedNoText(proof: ContactSnapshot, cardId: string): void {
  expect(proof.dispatch).toEqual({ ok: true });
  expect(proof.hand).toEqual([]);
  expect(proof.remove).toContain(cardId);
  expect(proof.actorAp).toBe(1000);
  expect(proof.cutInUsed).toBe(true);
  expect(proof.openEffects).toBe(0);
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
}

function proveCriminal(card: typeof PR158 | typeof PR164) {
  const otherPrinting = card.id === PR158.id ? PR164.id : PR158.id;
  const apByPriorCount = [0, 1, 2].map((priorCount) => runCutIn(card, {
    ownerRemove: priorCount === 0 ? [] : priorCount === 1 ? [otherPrinting] : [card.id, otherPrinting],
    opponentRemove: [PR158.id, PR164.id],
  }).actorAp);
  const offTurn = runCutIn(card, {
    turnPlayer: 'opp',
    ownerRemove: [card.id, otherPrinting],
    opponentRemove: [PR158.id, PR164.id],
  });
  expectUsedNoText(offTurn, card.id);
  const mirrored = runCutIn(card, {
    owner: 'opp',
    turnPlayer: 'opp',
    ownerRemove: [card.id, otherPrinting],
    opponentRemove: [PR158.id, PR164.id],
  });
  return {
    apByPriorCount,
    offTurnAp: offTurn.actorAp,
    used: offTurn.remove,
    cutInUsed: offTurn.cutInUsed,
    expectedUsed: [card.id, otherPrinting, card.id],
    mirroredAp: mirrored.actorAp,
    mirroredUsed: mirrored.remove,
  };
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  for (const card of [
    ...QA_CARDS,
    BLACK_ACTOR_DEF,
    BLACK_LEVEL7_ACTOR_DEF,
    BLACK_NO_CUTIN_ACTOR_DEF,
    RED_ACTOR_DEF,
    OTHER_DEF,
    FILLER_DEF,
    BLACK_PARTNER_DEF,
    RED_PARTNER_DEF,
  ]) register(card);
  registerTriggeredListener();
});

afterEach(() => endMatchSession());

describe('f026 cut-in public authority', () => {
  it('card:B08085:f0267a26 applies +2000 on its owner turn but is used with no text off-turn', () => {
    const ownTurn = runCutIn(B08085);
    expect({ B08085: ownTurn.actorAp, used: ownTurn.remove, cutInUsed: ownTurn.cutInUsed })
      .toEqual({ B08085: 3000, used: [B08085.id], cutInUsed: true });

    const offTurn = runCutIn(B08085, { turnPlayer: 'opp' });
    expectUsedNoText(offTurn, B08085.id);

    const mirrored = runCutIn(B08085, { owner: 'opp', turnPlayer: 'opp' });
    expect({ mirror: mirrored.actorAp, used: mirrored.remove, cutInUsed: mirrored.cutInUsed })
      .toEqual({ mirror: 3000, used: [B08085.id], cutInUsed: true });
  });

  it('card:B08086:f0267a26 separates the turn gate from its black-character gate', () => {
    const black = runCutIn(B08086);
    const nonBlack = runCutIn(B08086, { actorCardId: RED_ACTOR });
    const offTurnBlack = runCutIn(B08086, { turnPlayer: 'opp' });
    expectUsedNoText(nonBlack, B08086.id);
    expectUsedNoText(offTurnBlack, B08086.id);
    expect({
      B08086: black.actorAp,
      nonBlack: nonBlack.actorAp,
      offTurnBlack: offTurnBlack.actorAp,
      usedOffTurn: offTurnBlack.remove,
      cutInUsed: offTurnBlack.cutInUsed,
    }).toEqual({
      B08086: 3000,
      nonBlack: 1000,
      offTurnBlack: 1000,
      usedOffTurn: [B08086.id],
      cutInUsed: true,
    });
  });

  it('card:B10091:f0267a26 enters only when every own-turn cut-in gate is valid', () => {
    const positive = runCutIn(B10091, { partnerCardId: BLACK_PARTNER });
    const entered = currentState().players.self.scene.find(entry => entry.cardId === B10091.id);
    expect({
      B10091: positive.dispatch,
      hand: positive.hand,
      remove: positive.remove,
      scene: positive.sceneIds,
      enteredByCutin: entered?.turnEffects.enteredByCutinEffectThisTurn,
      cutInUsed: positive.cutInUsed,
    }).toEqual({
      B10091: { ok: true },
      hand: [],
      remove: [],
      scene: [BLACK_ACTOR, B10091.id],
      enteredByCutin: true,
      cutInUsed: true,
    });

    const mirrored = runCutIn(B10091, {
      owner: 'opp',
      turnPlayer: 'opp',
      partnerCardId: BLACK_PARTNER,
    });
    const mirroredEntered = currentState().players.opp.scene.find(entry => entry.cardId === B10091.id);
    expect({
      mirrorScene: mirrored.sceneIds,
      mirrorRemove: mirrored.remove,
      enteredByCutin: mirroredEntered?.turnEffects.enteredByCutinEffectThisTurn,
    }).toEqual({
      mirrorScene: [BLACK_ACTOR, B10091.id],
      mirrorRemove: [],
      enteredByCutin: true,
    });

    for (const options of [
      { turnPlayer: 'opp' as const, partnerCardId: BLACK_PARTNER },
      { partnerCardId: RED_PARTNER },
      { partnerCardId: BLACK_PARTNER, actorCardId: RED_ACTOR },
      { partnerCardId: BLACK_PARTNER, actorCardId: BLACK_LEVEL7_ACTOR },
      { partnerCardId: BLACK_PARTNER, actorCardId: BLACK_NO_CUTIN_ACTOR },
    ]) {
      const noText = runCutIn(B10091, options);
      expectUsedNoText(noText, B10091.id);
      expect({ hand: noText.hand, remove: noText.remove, scene: noText.sceneIds })
        .toEqual({ hand: [], remove: [B10091.id], scene: [options.actorCardId ?? BLACK_ACTOR] });
    }
  });

  it('B10091 uses a public five-candidate switch and enters from its exact remove occurrence', () => {
    const proof = runCutIn(B10091, { partnerCardId: BLACK_PARTNER, fullScene: true });
    expect(proof.dispatch).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: 'self',
      ownerPlayer: 'self',
      atomVerb: 'sceneEnter',
      nMin: 1,
      nMax: 1,
    });
    expect(pending?.candidates.map(candidate => candidate.uid)).toEqual([
      ACTOR_UID,
      'f026-filler-1',
      'f026-filler-2',
      'f026-filler-3',
      'f026-filler-4',
    ]);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve',
      pickedUid: 'f026-filler-2',
    }))).toEqual({ ok: true });

    const after = currentState();
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some(entry => entry.cardId === B10091.id)).toBe(true);
    expect(after.players.self.scene.some(entry => entry.uid === 'f026-filler-2')).toBe(false);
    expect(after.players.self.remove).toEqual([FILLER_CARD]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(after.pendingRuntimeState).toBeUndefined();
  });

  it('card:PR158:f0267a26 counts the used printing and only its owner remove pile', () => {
    const proof = proveCriminal(PR158);
    expect({ PR158: proof.apByPriorCount, offTurnAp: proof.offTurnAp, used: proof.used, mirror: proof.mirroredAp, mirrorUsed: proof.mirroredUsed, cutInUsed: proof.cutInUsed })
      .toEqual({ PR158: [3000, 5000, 7000], offTurnAp: 1000, used: proof.expectedUsed, mirror: 7000, mirrorUsed: proof.expectedUsed, cutInUsed: true });
  });

  it('card:PR164:f0267a26 counts the used printing and only its owner remove pile', () => {
    const proof = proveCriminal(PR164);
    expect({ PR164: proof.apByPriorCount, offTurnAp: proof.offTurnAp, used: proof.used, mirror: proof.mirroredAp, mirrorUsed: proof.mirroredUsed, cutInUsed: proof.cutInUsed })
      .toEqual({ PR164: [3000, 5000, 7000], offTurnAp: 1000, used: proof.expectedUsed, mirror: 7000, mirrorUsed: proof.expectedUsed, cutInUsed: true });
  });
});
