// qa: card:D07014:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D07015:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B05041 } from '@/cards/ct-p05/B05041';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D07014 } from '@/cards/ct-d07/D07014';
import { D07015 } from '@/cards/ct-d07/D07015';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA_SUFFIX = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const ATTACKER = 'QA_D07_ATTACKER';
const OTHER_VICTIM = 'QA_D07_OTHER_VICTIM';
const OPP_TARGET = 'QA_D07_OPP_TARGET';
const OPP_LEVEL_DECOY = 'QA_D07_OPP_LEVEL_DECOY';
const SELF_SIDE_DECOY = 'QA_D07_SELF_SIDE_DECOY';
const OPP_TOP = 'QA_D07_OPP_TOP';
const OPP_TAIL = 'QA_D07_OPP_TAIL';
const OPP_KEEP = 'QA_D07_OPP_KEEP';

const sourceCards = [D07014, D07015] as const;

function qa(card: CardDef): string {
  return `card:${card.id}:${QA_SUFFIX}`;
}

function fixtureCard(id: string, level = 1, ap = 1000): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['blue'],
    level,
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

function restartSession(player: Player = 'self'): void {
  endMatchSession();
  beginMatchSession(player);
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function stateFor(
  card: CardDef,
  turn: Player,
  options: { target?: boolean; otherVictim?: boolean; protectedTarget?: boolean } = {},
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  const target = makeChar({ cardId: OPP_TARGET, uid: 'opp-target', state: 'active' });
  if (options.protectedTarget) {
    target.setCards = [{ cardId: B05041.id, faceUp: true, instanceId: 'set:protected' }];
  }
  state.players.self.scene = [
    makeChar({ cardId: card.id, uid: 'source', state: 'sleep' }),
    makeChar({ cardId: SELF_SIDE_DECOY, uid: 'self-side-decoy', state: 'active' }),
    ...(options.otherVictim ? [makeChar({ cardId: OTHER_VICTIM, uid: 'other-victim', state: 'sleep' })] : []),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
  ];
  state.players.opp.scene = [
    makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' }),
    ...(options.target === false ? [] : [target]),
    makeChar({ cardId: OPP_LEVEL_DECOY, uid: 'opp-level-decoy', state: 'active' }),
  ];
  state.players.opp.hand = [OPP_KEEP];
  state.players.opp.deck = [OPP_TOP, OPP_TAIL];
  return state;
}

function removeThroughPublicContact(targetUid: string): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function expectLeaveTrigger(card: CardDef): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === 'a1'
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${card.id}: exact leave trigger provenance`).toMatchObject({
    source: { cardId: card.id, uid: 'source', abilityId: 'a1', player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function publicPick(card: CardDef) {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${card.id}: public up-to-one opponent removal`).toMatchObject({
    player: 'self',
    source: { cardId: card.id, uid: 'source', abilityId: 'a1' },
    nMin: 0,
    nMax: 1,
  });
  expect(pending!.candidates.map((candidate) => candidate.uid), `${card.id}: only level-4 opponent target is eligible`).toEqual(['opp-target']);
  return pending!;
}

function resolvePick(card: CardDef, pickedUid: string | null): void {
  const pending = publicPick(card);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid,
  }))).toEqual({ ok: true });
}

function expectSettled(card: CardDef): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 3 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${card.id}: terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingEffectOptional, `${card.id}: no unresolved optional`).toBeNull();
  expect(store.activeActionId, `${card.id}: no open action`).toBeNull();
  expect(current().pendingEffects.filter((entry) => (
    entry.source.cardId === card.id && (entry.state === 'pending' || entry.state === 'resolving')
  )), `${card.id}: no unresolved source effect`).toEqual([]);
}

function outcome(card: CardDef): unknown {
  const state = current();
  const removeIndex = state.log.findIndex((entry) => entry.action === 'effect:sceneRemove' && entry.target === 'opp-target');
  const drawIndex = state.log.findIndex((entry) => entry.action === 'effect:draw');
  return {
    sourceRemove: state.players.self.remove.filter((cardId) => cardId === card.id).length,
    targetRemove: state.players.opp.remove.filter((cardId) => cardId === OPP_TARGET).length,
    targetOnScene: state.players.opp.scene.some((char) => char.uid === 'opp-target'),
    levelDecoyOnScene: state.players.opp.scene.some((char) => char.uid === 'opp-level-decoy'),
    opponentHand: [...state.players.opp.hand],
    opponentDeck: [...state.players.opp.deck],
    removalBeforeDraw: removeIndex >= 0 && drawIndex > removeIndex,
    drawLogCount: state.log.filter((entry) => entry.action === 'effect:draw').length,
  };
}

function provePositive(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'opp'));
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  const pending = publicPick(card);
  resolvePick(card, pending.candidates[0]!.uid);
  expectSettled(card);
  return outcome(card);
}

function proveDecline(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'opp'));
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  resolvePick(card, null);
  expectSettled(card);
  return outcome(card);
}

function proveNoTarget(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'opp', { target: false }));
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  expect(useGameStateStore.getState().pendingEffectPick, `${card.id}: zero candidates auto-stop the chain`).toBeNull();
  expectSettled(card);
  return outcome(card);
}

function proveProtectedTarget(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'opp', { protectedTarget: true }));
  removeThroughPublicContact('source');
  expectLeaveTrigger(card);
  resolvePick(card, 'opp-target');
  expectSettled(card);
  const state = current();
  return {
    sourceRemove: state.players.self.remove.filter((cardId) => cardId === card.id).length,
    targetOnScene: state.players.opp.scene.some((char) => char.uid === 'opp-target'),
    targetRemove: state.players.opp.remove.filter((cardId) => cardId === OPP_TARGET).length,
    opponentHand: [...state.players.opp.hand],
    opponentDeck: [...state.players.opp.deck],
    blockedLogCount: state.log.filter((entry) => (
      entry.action === 'effect:sceneRemove'
        && entry.target === 'opp-target'
        && entry.result === 'blocked-protected'
    )).length,
    drawLogCount: state.log.filter((entry) => entry.action === 'effect:draw').length,
  };
}

function proveSelfTurn(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'self'));
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = pending!.candidates.find((candidate) => candidate.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve',
    pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  expectSettled(card);
  return {
    ...outcome(card),
    triggerCount: current().pendingEffects.filter((entry) => (
      entry.source.cardId === card.id && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
  };
}

function proveOtherLeave(card: CardDef): unknown {
  restartSession();
  install(stateFor(card, 'opp', { otherVictim: true }));
  removeThroughPublicContact('other-victim');
  expectSettled(card);
  return {
    ...outcome(card),
    sourceOnScene: current().players.self.scene.some((char) => char.uid === 'source'),
    otherVictimRemove: current().players.self.remove.filter((cardId) => cardId === OTHER_VICTIM).length,
    triggerCount: current().pendingEffects.filter((entry) => (
      entry.source.cardId === card.id && entry.triggeredBy.hook === 'leave:to-remove'
    )).length,
  };
}

function prove(card: CardDef): unknown {
  return {
    positive: provePositive(card),
    decline: proveDecline(card),
    noTarget: proveNoTarget(card),
    protectedTarget: proveProtectedTarget(card),
    selfTurn: proveSelfTurn(card),
    otherLeave: proveOtherLeave(card),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [
    ...sourceCards,
    B05041,
    B10022,
    fixtureCard(ATTACKER, 9, 9000),
    fixtureCard(OTHER_VICTIM),
    fixtureCard(OPP_TARGET, 4, 2000),
    fixtureCard(OPP_LEVEL_DECOY, 5, 3000),
    fixtureCard(SELF_SIDE_DECOY, 4, 1500),
    fixtureCard(OPP_TOP),
    fixtureCard(OPP_TAIL),
    fixtureCard(OPP_KEEP),
  ].forEach(register);
  registerTriggeredListener();
  restartSession();
});

afterEach(() => endMatchSession());

describe('D07014 / D07015 opponent-turn leave chain through public dispatch', () => {
  it(qa(D07014), () => {
    const proof = prove(D07014);
    expect(proof, `${D07014.id}: removal is optional and opponent draws only after a real removal`).toEqual({
      positive: {
        sourceRemove: 1, targetRemove: 1, targetOnScene: false, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP, OPP_TOP], opponentDeck: [OPP_TAIL], removalBeforeDraw: true, drawLogCount: 1,
      },
      decline: {
        sourceRemove: 1, targetRemove: 0, targetOnScene: true, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], removalBeforeDraw: false, drawLogCount: 0,
      },
      noTarget: {
        sourceRemove: 1, targetRemove: 0, targetOnScene: false, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], removalBeforeDraw: false, drawLogCount: 0,
      },
      protectedTarget: {
        sourceRemove: 1, targetOnScene: true, targetRemove: 0,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], blockedLogCount: 1, drawLogCount: 0,
      },
      selfTurn: expect.objectContaining({
        sourceRemove: 1, targetRemove: 0, targetOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], drawLogCount: 0, triggerCount: 0,
      }),
      otherLeave: expect.objectContaining({
        sourceRemove: 0, targetRemove: 0, targetOnScene: true, sourceOnScene: true, otherVictimRemove: 1,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], drawLogCount: 0, triggerCount: 0,
      }),
    });
  });

  it(qa(D07015), () => {
    expect(D07015.abilities, `${D07015.id}: parallel printing keeps the complete D07014 ability`).toEqual(D07014.abilities);
    const proof = prove(D07015);
    expect(proof, `${D07015.id}: its own public leave path preserves the same removal-then-draw contract`).toEqual({
      positive: {
        sourceRemove: 1, targetRemove: 1, targetOnScene: false, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP, OPP_TOP], opponentDeck: [OPP_TAIL], removalBeforeDraw: true, drawLogCount: 1,
      },
      decline: {
        sourceRemove: 1, targetRemove: 0, targetOnScene: true, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], removalBeforeDraw: false, drawLogCount: 0,
      },
      noTarget: {
        sourceRemove: 1, targetRemove: 0, targetOnScene: false, levelDecoyOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], removalBeforeDraw: false, drawLogCount: 0,
      },
      protectedTarget: {
        sourceRemove: 1, targetOnScene: true, targetRemove: 0,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], blockedLogCount: 1, drawLogCount: 0,
      },
      selfTurn: expect.objectContaining({
        sourceRemove: 1, targetRemove: 0, targetOnScene: true,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], drawLogCount: 0, triggerCount: 0,
      }),
      otherLeave: expect.objectContaining({
        sourceRemove: 0, targetRemove: 0, targetOnScene: true, sourceOnScene: true, otherVictimRemove: 1,
        opponentHand: [OPP_KEEP], opponentDeck: [OPP_TOP, OPP_TAIL], drawLogCount: 0, triggerCount: 0,
      }),
    });
  });
});
