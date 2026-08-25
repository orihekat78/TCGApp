// qa: card:B05092:2bb0d1134005d964c09d50ab280f7c81db291b8893da82fac9b0e7feed9e55c8
// qa: card:B05092:4d673c3dfcb71f99d51f123ad66fa10efac33ab915d9acf3fbc749682239ddbe
// qa: card:B05092:8786a477fc176a7663a4aa9f7e94a6439537f0d782b8688e1fe64f68f13b1b4f
// qa: card:B05092:a4313105cbdbcb2713395cbb04bd163a24f421501dc7f646c4735b84f7c68138

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05092 } from '@/cards/ct-p05/B05092';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const POLICE = fixture('W152_POLICE', { level: 4, ap: 3000, traits: ['警察'] });
const BYSTANDER = fixture('W152_BYSTANDER', { ap: 6000 });
const TARGET = fixture('W152_TARGET', { ap: 5000 });
const HIGH_AP = fixture('W152_HIGH_AP', { ap: 8000 });
const HAND_A = fixture('W152_HAND_A');
const HAND_B = fixture('W152_HAND_B');
const DECK_A = fixture('W152_DECK_A');
const DECK_B = fixture('W152_DECK_B');
const DECK_C = fixture('W152_DECK_C');
const FILE_CARD = fixture('W152_FILE', { kind: 'event' });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave152 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave152-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(verb: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: verb, source: { cardId: B05092.id } });
  return pick!;
}

function choose(pick: ReturnType<typeof pendingPick>, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function actionBoard(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 52, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(B05092.id, 'source'),
    sceneChar(POLICE.id, 'actor'),
    sceneChar(BYSTANDER.id, 'bystander'),
  ];
  state.players[other(owner)].scene = [
    sceneChar(TARGET.id, 'target', { state: 'sleep' }),
    sceneChar(HIGH_AP.id, 'high-ap', { state: 'sleep' }),
  ];
  state.players[owner].deck = [DECK_A.id, DECK_B.id];
  state.players[other(owner)].deck = [DECK_C.id, DECK_A.id];
  return state;
}

function declare(owner: Player): { actionId: string; pick: ReturnType<typeof pendingPick> } {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  const pick = pendingPick('sceneToDeck');
  expect(pick.player).toBe(owner);
  return { actionId, pick };
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [
    POLICE, BYSTANDER, TARGET, HIGH_AP, HAND_A, HAND_B,
    DECK_A, DECK_B, DECK_C, FILE_CARD,
  ]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave152: B05092 zero-card entry shuffle', () => {
  it('shuffles the deck even when the owner moves zero hand cards', () => {
    const state = createEmptyGameState();
    state.turn = { number: 52, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['黄'];
    state.players.self.file = Array.from(
      { length: B05092.level ?? 0 },
      () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }),
    );
    state.players.self.hand = [B05092.id, HAND_A.id, HAND_B.id];
    state.players.self.deck = [DECK_A.id, DECK_B.id, DECK_C.id];
    install(state, 'self', 'zero-shuffle');
    const epochBefore = current().indexedZoneEpochs!.self.deck;

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B05092.id }))
      .toEqual({ ok: true });
    const pick = pendingPick('handToDeckBottom');
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([HAND_A.id, HAND_B.id]);
    choose(pick, null);

    expect(current().players.self.hand).toEqual([HAND_A.id, HAND_B.id]);
    expect([...current().players.self.deck].sort()).toEqual([DECK_A.id, DECK_B.id, DECK_C.id].sort());
    expect(current().indexedZoneEpochs!.self.deck).toBeGreaterThan(epochBefore);
  });

  it('also shuffles when using B05092 leaves no other hand cards', () => {
    const state = createEmptyGameState();
    state.turn = { number: 52, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['黄'];
    state.players.opp.file = Array.from(
      { length: B05092.level ?? 0 },
      () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }),
    );
    state.players.opp.hand = [B05092.id];
    state.players.opp.deck = [DECK_A.id, DECK_B.id, DECK_C.id];
    install(state, 'opp', 'empty-hand-shuffle');
    const epochBefore = current().indexedZoneEpochs!.opp.deck;

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: B05092.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.opp.hand).toEqual([]);
    expect([...current().players.opp.deck].sort()).toEqual([DECK_A.id, DECK_B.id, DECK_C.id].sort());
    expect(current().indexedZoneEpochs!.opp.deck).toBeGreaterThan(epochBefore);
  });
});

describe('official QA Wave152: B05092 action declaration timing', () => {
  it('opens after target and sleep, while guard remains blocked', () => {
    install(actionBoard('opp'), 'opp', 'before-guard');
    const { actionId, pick } = declare('opp');

    expect(current().players.opp.scene.find(character => character.uid === 'actor')?.state).toBe('sleep');
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('target');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('high-ap');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    choose(pick, null);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  });
});

describe('official QA Wave152: B05092 deck-top movement', () => {
  it('moves a chosen character face-down to the top of its owner deck', () => {
    install(actionBoard('self'), 'self', 'hidden-top');
    const { actionId, pick } = declare('self');
    const bystander = pick.candidates.find(candidate => candidate.uid === 'bystander');
    expect(bystander).toBeTruthy();
    choose(pick, bystander!.uid);

    expect(current().players.self.scene.some(character => character.uid === 'bystander')).toBe(false);
    expect(current().players.self.deck[0]).toBe(BYSTANDER.id);
    expect(useGameStateStore.getState().activeActionId).toBe(actionId);
    for (const mode of ['solo-self', 'spectator'] as const) {
      expect(projectReplayStateForViewer(current(), mode).players.self.deck[0]).not.toBe(BYSTANDER.id);
    }
  });

  it('ends the action when the declared target moves to deck top', () => {
    const owner = 'opp' as const;
    const defender = other(owner);
    install(actionBoard(owner), owner, 'target-leaves');
    const { actionId, pick } = declare(owner);
    const target = pick.candidates.find(candidate => candidate.uid === 'target');
    expect(target).toBeTruthy();
    choose(pick, target!.uid);

    expect(current().players[defender].scene.some(character => character.uid === 'target')).toBe(false);
    expect(current().players[defender].deck[0]).toBe(TARGET.id);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
  });
});
