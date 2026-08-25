// qa: card:B02088:4960b906976210e8a8d17152c0f10630265edca04f7db484487532b661306134
// qa: card:B02088:93cc0cd820f469b370d02694a51ede409f0f50313a74eee526eb5a3fcea3aaf1
// qa: card:B02088:a0c7e6e6f58df97e5742a601c5a48c218ce7c41eb6efeaf0e971747694d67076
// qa: card:B02088:e944414b8bab4d74e84b324f9b0f0d76a50630e73dfb71b30b4eb5f2e8837b4c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02088 } from '@/cards/ct-p02/B02088';
import { B02088P } from '@/cards/ct-p02/B02088P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const ATTACKER = 'W148_ATTACKER';
const TARGET = 'W148_TARGET';
const FILLER = ['W148_FILLER_1', 'W148_FILLER_2', 'W148_FILLER_3', 'W148_FILLER_4'] as const;
const CASE = 'W148_CASE';
const ACTION_EVIDENCE = 'W148_ACTION_EVIDENCE';
const OBSERVER_DRAW = 'W148_OBSERVER_DRAW';
const TAIL = 'W148_TAIL';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const GAIN_OBSERVER_ABILITY: AbilityDef = {
  id: 'gain', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'evidence:gain', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Draw after this character gains evidence through a case action.',
  ruleRefs: ['rules/10-action-event.md'],
};

const GAIN_OBSERVER = fixture(ATTACKER, { ap: 9000, abilities: [GAIN_OBSERVER_ABILITY] });
const ROWS = [
  { label: 'base-self', owner: 'self' as const, card: B02088 },
  { label: 'parallel-opp', owner: 'opp' as const, card: B02088P },
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave148 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave148-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function reachFirstContact(owner: Player): string {
  const targetOwner = other(owner);
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 8; step += 1) {
    const action = current().actionContexts?.[actionId];
    const actingUid = action?.phase === 'action-1'
      ? action.firstUid
      : action?.phase === 'action-2' ? action.secondUid : undefined;
    if (actingUid === 'attacker') {
      expect(current().players[targetOwner].scene.some(character => character.uid === 'target')).toBe(true);
      return actionId;
    }
    if (actingUid === 'target') {
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: targetOwner, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave148 did not reach the first contact action');
}

function openCaseHirameki(owner: Player, card: CardDef, label: string): string {
  const attacker = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 48, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[attacker].scene = [sceneChar(GAIN_OBSERVER.id, 'attacker')];
  state.players[attacker].deck = [ACTION_EVIDENCE, OBSERVER_DRAW, TAIL];
  state.players[owner].case = {
    ...state.players[owner].case, cardId: CASE, status: '事件編', colors: ['青'],
  };
  state.players[owner].evidence = [{
    cardId: card.id, faceUp: false, origin: { turn: 1, via: 'opening' },
  }];
  install(state, owner, label);

  expect(dispatchEngineAction({
    type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: owner,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
    player: owner, cardId: card.id, abilityId: 'a4', effectValid: true,
  });
  return actionId;
}

function settleAction(actionId: string): void {
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  [
    GAIN_OBSERVER, fixture(TARGET, { ap: 1000 }), ...FILLER.map(id => fixture(id)),
    fixture(CASE, { kind: 'case', caseLevel: 7, caseTraits: [] }),
    fixture(ACTION_EVIDENCE), fixture(OBSERVER_DRAW), fixture(TAIL),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingHirameki();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave148: B02088 resolves every possible turn-end step', () => {
  it.each([
    { label: 'base-own-turn', owner: 'self' as const, turnPlayer: 'self' as const, card: B02088 },
    { label: 'parallel-opponent-turn', owner: 'opp' as const, turnPlayer: 'self' as const, card: B02088P },
  ])('$label gains itself face-up even when no evidence can be removed', ({ owner, turnPlayer, card, label }) => {
    const state = createEmptyGameState();
    state.turn = { number: 48, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(card.id, 'culprit')];
    state.players[owner].evidence = [];
    install(state, turnPlayer, label);

    expect(dispatchEngineAction({ type: 'endTurn', player: turnPlayer })).toEqual({ ok: true });
    expect(current().players[owner].scene.some(character => character.uid === 'culprit')).toBe(false);
    expect(current().players[owner].remove).toEqual([]);
    expect(current().players[owner].evidence).toEqual([
      expect.objectContaining({ cardId: card.id, faceUp: true }),
    ]);
  });
});

describe('official QA Wave148: B02088 Cut-In remains usable with a full scene', () => {
  it.each(ROWS)('$label uses the Cut-In but cannot enter a sixth character', ({ owner, card, label }) => {
    const targetOwner = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 48, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(GAIN_OBSERVER.id, 'attacker'),
      ...FILLER.map((id, index) => sceneChar(id, `filler-${index + 1}`)),
    ];
    state.players[owner].hand = [card.id];
    state.players[targetOwner].scene = [sceneChar(TARGET, 'target', { state: 'sleep' })];
    install(state, owner, `${label}-full-cutin`);
    const actionId = reachFirstContact(owner);

    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: card.id },
    })).toEqual({ ok: true });

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(character => character.cardId === card.id)).toBe(false);
    expect(current().players[owner].remove).toContain(card.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave148: B02088 Hirameki controls the actual gain event', () => {
  it.each(ROWS)('$label suppression prevents evidence and the dependent observer', ({ owner, card, label }) => {
    const attacker = other(owner);
    const actionId = openCaseHirameki(owner, card, `${label}-hirameki-fire`);
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    settleAction(actionId);

    expect(current().players[attacker].evidence).toEqual([]);
    expect(current().players[attacker].hand).toEqual([]);
    expect(current().players[attacker].deck).toEqual([ACTION_EVIDENCE, OBSERVER_DRAW, TAIL]);
    expect(current().players[owner].remove).toContain(card.id);
  });

  it.each(ROWS)('$label may decline so the attacker gains evidence and fires its observer', ({ owner, card, label }) => {
    const attacker = other(owner);
    const actionId = openCaseHirameki(owner, card, `${label}-hirameki-skip`);
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' })).toEqual({ ok: true });
    settleAction(actionId);

    expect(current().players[attacker].evidence).toEqual([
      expect.objectContaining({ cardId: ACTION_EVIDENCE, faceUp: false }),
    ]);
    expect(current().players[attacker].hand).toEqual([OBSERVER_DRAW]);
    expect(current().players[attacker].deck).toEqual([TAIL]);
    expect(current().players[owner].remove).toContain(card.id);
  });
});
