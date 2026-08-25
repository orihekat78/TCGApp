// qa: card:B06049:1522823aa460aa0572f53f018bc39a9461f8b0b892d70825d15382c5c94a0818
// qa: card:B06049:68cb616e7037c15b43574cfef1c5f00ad25c53eb054ed185b99894700a81c0d3
// qa: card:B06050:a0f94bba8509d4acfe102a31eb39dc8bcda03d5de444256e1a8f94f608eaf3e4
// qa: card:B06050:b0dedb9840a286bff2f817bbb1129574287876ab303fd5083762681f4170d8dc

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06049 } from '@/cards/ct-p06/B06049';
import { B06050 } from '@/cards/ct-p06/B06050';
import { B06050P } from '@/cards/ct-p06/B06050P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const YAIBA_WITNESS = fixture('W156_YAIBA_WITNESS', { traits: ['YAIBA'] });
const YAIBA_EVENT = fixture('W156_YAIBA_EVENT', { kind: 'event', traits: ['YAIBA'] });
const FILE_CARD = fixture('W156_FILE', { kind: 'event' });
const EVIDENCE = fixture('W156_EVIDENCE', { kind: 'event' });
const OWNER_BODY = fixture('W156_OWNER_BODY', { ap: 1000 });
const OTHER_BODY = fixture('W156_OTHER_BODY', { ap: 5000 });
const YAIBA_CASE = fixture('W156_YAIBA_CASE', {
  kind: 'case', level: undefined, ap: undefined, lp: undefined,
  caseLevel: 1, caseTraits: ['YAIBA'], colors: ['白'],
});

const helperAbilities: AbilityDef[] = [
  {
    id: 'enter-yaiba', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: {
        player: 'self', from: 'remove', max: 1, viaEffect: true,
        filter: { cardId: YAIBA_WITNESS.id, kind: 'character' },
      },
    },
    description: 'Enter the YAIBA witness.', ruleRefs: ['rules/15-abilities-effects.md'],
  },
  {
    id: 'remove-yaiba', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: {
        player: 'self', max: 1, side: 'self', cause: 'effect',
        filter: { cardId: YAIBA_WITNESS.id, kind: 'character' },
      },
    },
    description: 'Remove the YAIBA witness.', ruleRefs: ['rules/15-abilities-effects.md'],
  },
];
const HELPER = fixture('W156_HELPER', { abilities: helperAbilities });
const CUTIN_CARDS = [B06050, B06050P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave156 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave156-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function b06049State(owner: Player, witnessInScene: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 156, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: B06049.level ?? 0 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [B06049.id];
  state.players[owner].scene = [
    sceneChar(HELPER.id, 'helper'),
    ...(witnessInScene ? [sceneChar(YAIBA_WITNESS.id, 'witness')] : []),
  ];
  state.players[owner].remove = witnessInScene ? [] : [YAIBA_WITNESS.id];
  state.players[owner].deck = [FILE_CARD.id, FILE_CARD.id];
  state.players[other(owner)].deck = [FILE_CARD.id, FILE_CARD.id];
  state.players[other(owner)].evidence = [{
    cardId: EVIDENCE.id, faceUp: false, origin: { turn: 1, via: 'reasoning' },
  }];
  return state;
}

function useB06049(owner: Player): string {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06049.id }))
    .toEqual({ ok: true });
  const source = current().players[owner].scene.find(character => character.cardId === B06049.id);
  expect(source).toBeTruthy();
  return source!.uid;
}

function cutinState(card: CardDef, owner: Player, turnPlayer: Player): GameState {
  const state = createEmptyGameState();
  const opponent = other(owner);
  const ownerIsActor = owner === turnPlayer;
  state.turn = { number: 156, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: YAIBA_CASE.id, colors: ['白'], status: '事件編',
  };
  state.players[owner].hand = [card.id];
  state.players[owner].remove = [YAIBA_EVENT.id];
  state.players[owner].scene = [sceneChar(OWNER_BODY.id, 'owner-body', {
    state: ownerIsActor ? 'active' : 'sleep',
  })];
  state.players[opponent].scene = [sceneChar(OTHER_BODY.id, 'other-body', {
    state: ownerIsActor ? 'sleep' : 'active',
  })];
  state.players.self.deck = [FILE_CARD.id, FILE_CARD.id];
  state.players.opp.deck = [FILE_CARD.id, FILE_CARD.id];
  return state;
}

function reachOwnerContactWindow(owner: Player, turnPlayer: Player): string {
  const ownerIsActor = owner === turnPlayer;
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: ownerIsActor ? 'owner-body' : 'other-body',
    targetUid: ownerIsActor ? 'other-body' : 'owner-body',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(flow.action._getContext(current(), actionId)).toMatchObject({
    phase: 'action-1', firstUid: 'owner-body',
  });
  return actionId;
}

function openCutinChoice(card: CardDef, owner: Player, turnPlayer: Player) {
  install(cutinState(card, owner, turnPlayer), owner, `${card.id}-${owner}-${turnPlayer}`);
  const actionId = reachOwnerContactWindow(owner, turnPlayer);
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: owner,
    choice: { kind: 'cutin', cardId: card.id },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice).toMatchObject({ player: owner, source: { cardId: card.id, abilityId: 'a1' } });
  expect(choice?.options).toHaveLength(2);
  return choice!;
}

function resolveChoice(choice: ReturnType<typeof openCutinChoice>, index: number): void {
  expect(dispatchEngineAction(bindPendingDecision(choice, {
    type: 'choiceResolve', choiceIndex: index,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [YAIBA_WITNESS, YAIBA_EVENT, FILE_CARD, EVIDENCE, OWNER_BODY, OTHER_BODY, YAIBA_CASE, HELPER]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave156: B06049 entry-time YAIBA snapshot', () => {
  it.each(['self', 'opp'] as const)('owner=%s does not gain 突撃 when YAIBA arrives only after entry', owner => {
    install(b06049State(owner, false), owner, `${owner}-late-yaiba`);
    const sourceUid = useB06049(owner);
    expect(read.char.keywords(current(), sourceUid)).not.toContain('突撃');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'helper', abilId: 'enter-yaiba' }))
      .toEqual({ ok: true });
    const enter = pendingPick(HELPER.id, 'enter-yaiba', 'sceneEnter');
    choose(enter, enter.candidates.find(candidate => candidate.cardId === YAIBA_WITNESS.id)!.uid);

    expect(read.char.keywords(current(), sourceUid)).not.toContain('突撃');
    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: sourceUid, targetPlayer: other(owner),
    })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it.each(['self', 'opp'] as const)('owner=%s keeps granted 突撃 after the other YAIBA leaves', owner => {
    install(b06049State(owner, true), owner, `${owner}-persisted-yaiba`);
    const sourceUid = useB06049(owner);
    expect(read.char.keywords(current(), sourceUid)).toContain('突撃');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'helper', abilId: 'remove-yaiba' }))
      .toEqual({ ok: true });
    const removal = pendingPick(HELPER.id, 'remove-yaiba', 'sceneRemove');
    choose(removal, removal.candidates.find(candidate => candidate.uid === 'witness')!.uid);

    expect(current().players[owner].scene.some(character => character.uid === 'witness')).toBe(false);
    expect(read.char.keywords(current(), sourceUid)).toContain('突撃');
    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: sourceUid, targetPlayer: other(owner),
    })).toEqual({ ok: true });
  });
});

describe('official QA Wave156: B06050/P Cut-In choice', () => {
  it.each(CUTIN_CARDS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner applies exactly the chosen one of its two effects',
    ({ card, owner }) => {
      const apChoice = openCutinChoice(card, owner, owner);
      resolveChoice(apChoice, 0);
      surfacePendingSideChannels();
      expect(read.char.ap(current(), 'owner-body')).toBe(3000);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([card.id, YAIBA_EVENT.id]));
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

      const retrievalChoice = openCutinChoice(card, owner, owner);
      resolveChoice(retrievalChoice, 1);
      const retrieval = pendingPick(card.id, 'a1', 'handAddFromRemove');
      expect(retrieval.candidates.map(candidate => candidate.cardId)).toEqual([YAIBA_EVENT.id]);
      choose(retrieval, retrieval.candidates[0]!.uid);
      expect(read.char.ap(current(), 'owner-body')).toBe(1000);
      expect(current().players[owner].hand).toEqual([YAIBA_EVENT.id]);
    },
  );

  it.each(CUTIN_CARDS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may choose its own-turn AP option off-turn and gets no effect',
    ({ card, owner }) => {
      const choice = openCutinChoice(card, owner, other(owner));
      resolveChoice(choice, 0);
      surfacePendingSideChannels();

      expect(read.char.ap(current(), 'owner-body')).toBe(1000);
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([card.id, YAIBA_EVENT.id]));
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    },
  );
});
