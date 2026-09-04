// qa: card:B07031:5a3bf6716303171e5a355286c8ea7863437a9946cab30a09b076210246f250d2
// qa: card:B07031:48340448bd76e8a3eb79d6c85817dc581f1569c8e7e620277e9c61d82072cc94
// qa: card:B07031:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07032:e1b55d920d23d829eda49242790ee61ef7d85cf45d2a3b48d4aa5fb8c6b176bd
// qa: card:B07033:4006f5213020543decf5ce3d53690050881602191cb3ad0a24d14c026c39ab5d
// qa: card:B07034:031fb71e09893fc1246cfa035f4788e78999fc8ad99714580d9d0b82f34627c3
// qa: card:B07034:d71b9e6c2babf72f5b2352e1ef9f8eee06ec0be26c9bd4ff573c08887a09f47b
// qa: card:B07034:924a8b39ee3036e70eeeac9c3a5941e4faa4fec3ebc39e19ceb12b4b0f2419af
// qa: card:B07039:3f11f91e24ebb7e85baa7fd7f450d163079938ad38bb0c766a95a8759df9351e

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02020 } from '@/cards/ct-p02/B02020';
import { B02020P } from '@/cards/ct-p02/B02020P';
import { B07033 } from '@/cards/ct-p07/B07033';
import { B07033P } from '@/cards/ct-p07/B07033P';
import { B07033P2 } from '@/cards/ct-p07/B07033P2';
import { B07031 } from '@/cards/ct-p07/B07031';
import { B07031P } from '@/cards/ct-p07/B07031P';
import { B07032 } from '@/cards/ct-p07/B07032';
import { B07032P } from '@/cards/ct-p07/B07032P';
import { B07034 } from '@/cards/ct-p07/B07034';
import { B07034P } from '@/cards/ct-p07/B07034P';
import { B07039 } from '@/cards/ct-p07/B07039';
import { B07039P } from '@/cards/ct-p07/B07039P';
import { PR234 } from '@/cards/pr-01/PR234';
import { PR240 } from '@/cards/pr-01/PR240';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const WHITE_PARTNER = fixture('W167_WHITE_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const RED_MAGIC_CASE = fixture('W167_RED_MAGIC_CASE', {
  kind: 'case', level: undefined, ap: undefined, lp: undefined, traits: ['赤魔術'],
});
const OLD_FACE = fixture('W167_OLD_FACE', { ap: 3000 });
const TARGET = fixture('W167_TARGET', { ap: 1000 });
const JEWEL = fixture('W167_JEWEL', { kind: 'event', traits: ['ビッグジュエル'] });
const PA_SEED = fixture('W167_PA_SEED', { kind: 'event', traits: ['ビッグジュエル'] });
const SET_CARD = fixture('W167_SET_CARD', { kind: 'event' });
const SET_CARD_B = fixture('W167_SET_CARD_B', { kind: 'event' });
const SHUFFLE_ROMANCE = fixture('W167_SHUFFLE_ROMANCE', {
  kind: 'event', names: ['シャッフルロマンス'],
});
const HOST = fixture('W167_HOST');
const HOST_B = fixture('W167_HOST_B');
const VICTIM = fixture('W167_VICTIM', { ap: 7000, level: 7 });
const WHITE_ENTRY = fixture('W167_WHITE_ENTRY', { colors: ['白'], level: 3 });
const HAND_FODDER = fixture('W167_HAND_FODDER', { kind: 'event' });
const DRAW = fixture('W167_DRAW', { kind: 'event' });
const BATCH_CASE = fixture('W167_BATCH_CASE', {
  kind: 'case', level: undefined, ap: undefined, lp: undefined, traits: ['赤魔術'],
  abilities: [{
    id: 'a1', type: 'declared', scope: 'always',
    cost: {
      kind: 'removeFromScene',
      target: {
        kind: 'pick', query: { area: 'scene', side: 'self' },
        n: { min: 2, max: 2 }, chooser: 'self',
      },
      n: 2,
    },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: 'Wave167 simultaneous leave fixture.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const FIXTURES = [
  WHITE_PARTNER, RED_MAGIC_CASE, OLD_FACE, TARGET, JEWEL, PA_SEED, SET_CARD,
  SET_CARD_B, SHUFFLE_ROMANCE, HOST, HOST_B, VICTIM, WHITE_ENTRY, HAND_FODDER,
  DRAW, BATCH_CASE,
];
const B07031_PRINTS = [B07031, B07031P] as const;
const B07032_PRINTS = [B07032, B07032P] as const;
const B07033_PRINTS = [B07033, B07033P, B07033P2] as const;
const B07034_PRINTS = [B07034, B07034P] as const;
const B07039_PRINTS = [B07039, B07039P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave167 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave167-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(
  pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>,
  pickedUid: string | null,
  pickedUids?: string[],
): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
    ...(pickedUids ? { pickedUids } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function confirmOwnerOrder(owner: Player): void {
  const group = pendingOwnerOrderGroup(current(), owner);
  expect(group.length).toBeGreaterThanOrEqual(2);
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: owner, entryIds: group.map(entry => entry.id),
  })).toEqual({ ok: true });
}

function reachActorWindow(owner: Player = 'self'): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave167 contact ended before actor window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      if (player === owner && uid === 'actor') return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave167 actor window not reached');
}

function redMagicState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 167, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    ...state.players.self.case, cardId: RED_MAGIC_CASE.id, colors: ['赤'],
  };
  state.players.self.deck = [DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

function withSet(cardId: string, uid: string, setCardId: string, instanceId: string) {
  const character = sceneChar(cardId, uid);
  character.setCards = [{ cardId: setCardId, faceUp: false, instanceId }];
  return character;
}

function b07031State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: RED_MAGIC_CASE.id, colors: ['赤'],
  };
  state.players[owner].scene = [
    sceneChar(card.id, 'source', { state: 'active' }),
    withSet(HOST.id, 'host-a', SET_CARD.id, 'set-a'),
    withSet(HOST_B.id, 'host-b', SET_CARD_B.id, 'set-b'),
  ];
  state.players[other(owner)].scene = [
    sceneChar(VICTIM.id, 'victim'),
    withSet(HOST.id, 'opp-host', SET_CARD.id, 'opp-set'),
  ];
  state.players[owner].hand = [HAND_FODDER.id];
  state.players[owner].remove = [WHITE_ENTRY.id];
  state.players.self.deck = [DRAW.id, DRAW.id, DRAW.id];
  state.players.opp.deck = [DRAW.id, DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave167: B07031/P exact set occurrences and independent branches', () => {
  it.each(B07031_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner skips the character then takes one set card from each host and re-enters',
    ({ card, owner }) => {
      // Card-bound physical rows: B07031 B07031P.
      install(b07031State(card, owner), owner, `${card.id}-${owner}-set-pair`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a2', 'sceneRemove'), null);
      resolveOptional(card.id, 'a2', true);

      const setPick = pendingPick(card.id, 'a2', 'charRemoveSetCard');
      expect(setPick).toMatchObject({ nMin: 2, nMax: 2 });
      const selected = ['host-a', 'host-b'].map(hostUid => (
        setPick.candidates.find(candidate => candidate.hostUid === hostUid)!
      ));
      expect(selected.every(Boolean)).toBe(true);
      choose(setPick, selected[0]!.uid, selected.map(candidate => candidate.uid));
      const entry = pendingPick(card.id, 'a2', 'sceneEnter');
      const target = entry.candidates.find(candidate => candidate.cardId === WHITE_ENTRY.id)!;
      choose(entry, target.uid);

      expect(current().players[owner].scene.find(character => character.uid === 'host-a')?.setCards).toEqual([]);
      expect(current().players[owner].scene.find(character => character.uid === 'host-b')?.setCards).toEqual([]);
      expect(current().players[other(owner)].scene.find(character => character.uid === 'opp-host')?.setCards)
        .toHaveLength(1);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([
        HAND_FODDER.id, SET_CARD.id, SET_CARD_B.id,
      ]));
      expect(current().players[owner].scene.some(character => character.cardId === WHITE_ENTRY.id)).toBe(true);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'victim')).toBe(true);
    },
  );

  it.each(B07031_PRINTS)('$id may remove the character and decline the later set-card branch', card => {
    // Card-bound physical rows: B07031 B07031P.
    install(b07031State(card, 'self'), 'self', `${card.id}-remove-decline`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    choose(pendingPick(card.id, 'a2', 'sceneRemove'), 'victim');
    resolveOptional(card.id, 'a2', false);
    expect(current().players.opp.scene.some(character => character.uid === 'victim')).toBe(false);
    expect(current().players.opp.remove).toContain(VICTIM.id);
    expect(current().players.self.scene.find(character => character.uid === 'host-a')?.setCards).toHaveLength(1);
    expect(current().players.self.scene.find(character => character.uid === 'host-b')?.setCards).toHaveLength(1);
    expect(current().players.self.scene.some(character => character.cardId === WHITE_ENTRY.id)).toBe(false);
  });
});

describe('official QA Wave167: B07031/P and B07034/P hand cost ownership', () => {
  const rows = [
    ...B07031_PRINTS.map(card => ({ card, abilityId: 'a2', abilityIndex: 1, redMagic: true })),
    ...B07034_PRINTS.map(card => ({ card, abilityId: 'a2', abilityIndex: 1, redMagic: false })),
  ];

  it.each(rows.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$card.id owner=$owner pays only the owner hand occurrence',
    ({ card, abilityId, abilityIndex, redMagic, owner }) => {
      // Card-bound physical rows: B07031 B07031P B07034 B07034P.
      const state = createEmptyGameState();
      state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      state.players[owner].case = {
        ...state.players[owner].case,
        ...(redMagic ? { cardId: RED_MAGIC_CASE.id, colors: ['赤'] } : {}),
      };
      state.players[owner].hand = [HAND_FODDER.id];
      state.players[other(owner)].hand = [HAND_FODDER.id];
      state.players.self.deck = [DRAW.id, DRAW.id];
      state.players.opp.deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-hand-owner`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: abilityId,
        abilityOrigin: 'printed', abilityIndex,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });

      expect(current().players[owner].hand).not.toContain(HAND_FODDER.id);
      expect(current().players[owner].remove).toContain(HAND_FODDER.id);
      expect(current().players[other(owner)].hand).toEqual([HAND_FODDER.id]);
      if (card.id.startsWith('B07031')) {
        choose(pendingPick(card.id, abilityId, 'sceneRemove'), null);
        resolveOptional(card.id, abilityId, false);
      } else {
        choose(pendingPick(card.id, abilityId, 'sceneRemove'), null);
      }
    },
  );

  it.each(rows)('$card.id rejects an opponent-only hand without mutation', ({ card, abilityId, abilityIndex, redMagic }) => {
    // Card-bound physical rows: B07031 B07031P B07034 B07034P.
    const state = createEmptyGameState();
    state.turn = { number: 167, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(card.id, 'source', { state: 'active' })];
    state.players.self.case = {
      ...state.players.self.case,
      ...(redMagic ? { cardId: RED_MAGIC_CASE.id, colors: ['赤'] } : {}),
    };
    state.players.opp.hand = [HAND_FODDER.id];
    state.players.self.deck = [DRAW.id, DRAW.id];
    const before = JSON.stringify(state);
    install(state, 'self', `${card.id}-opponent-hand-negative`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: abilityId,
      abilityOrigin: 'printed', abilityIndex,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

function b07032State(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
  state.players[other(owner)].scene = [sceneChar(VICTIM.id, 'victim')];
  state.players[owner].hand = [HAND_FODDER.id];
  state.players[owner].partnerAreaCards = [JEWEL.id];
  state.players.self.deck = [DRAW.id, DRAW.id, DRAW.id];
  state.players.opp.deck = [DRAW.id, DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave167: B07032/P independent character and jewel branches', () => {
  it.each(B07032_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner skips the character and still removes the owner jewel to draw two',
    ({ card, owner }) => {
      // Card-bound physical rows: B07032 B07032P.
      install(b07032State(card, owner), owner, `${card.id}-${owner}-skip-char`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
      resolveOptional(card.id, 'a1', true);
      const jewelPick = pendingPick(card.id, 'a1', 'partnerAreaRemove');
      choose(jewelPick, jewelPick.candidates[0]!.uid);

      expect(current().players[other(owner)].scene.some(character => character.uid === 'victim')).toBe(true);
      expect(current().players[owner].partnerAreaCards).toEqual([]);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([HAND_FODDER.id, JEWEL.id]));
      expect(current().players[owner].hand).toEqual([DRAW.id, DRAW.id]);
    },
  );

  it.each(B07032_PRINTS)('$id may remove the character and decline the jewel branch', card => {
    // Card-bound physical rows: B07032 B07032P.
    install(b07032State(card, 'self'), 'self', `${card.id}-remove-decline`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'victim');
    resolveOptional(card.id, 'a1', false);
    expect(current().players.opp.scene).toHaveLength(0);
    expect(current().players.self.partnerAreaCards).toEqual([JEWEL.id]);
    expect(current().players.self.hand).toEqual([]);
  });
});

describe('official QA Wave167: B07033/P/P2 partner-area capacity', () => {
  it.each(B07033_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner uses its real FILE6 disguise and appends a ninth partner-area card',
    ({ card, owner }) => {
    // Card-bound physical rows: B07033 B07033P B07033P2.
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: DRAW.id }));
    state.players[owner].hand = [card.id];
    state.players[owner].scene = [sceneChar(OLD_FACE.id, 'actor', { state: 'active' })];
    state.players[owner].remove = [JEWEL.id];
    state.players[owner].partnerAreaCards = Array.from({ length: 8 }, () => PA_SEED.id);
    state.players.self.deck = [DRAW.id, DRAW.id];
    state.players.opp.deck = [DRAW.id, DRAW.id];
    state.players[opponent].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
    install(state, owner, `${card.id}-${owner}`);

    const actionId = reachActorWindow(owner);
    expect(/* B07033 B07033P B07033P2 */ dispatchEngineAction({
      type: 'actionContact', actionId, player: owner, choice: { kind: 'disguise', cardId: card.id },
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({
      player: owner, atomVerb: 'toPartnerArea', source: { cardId: card.id, abilityId: 'a2' },
    });
    const jewel = pick!.candidates.find(candidate => candidate.cardId === JEWEL.id)!;
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: jewel.uid,
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene.find(character => character.uid === 'actor')?.cardId).toBe(card.id);
    expect(current().players[owner].partnerAreaCards).toEqual([
      ...Array.from({ length: 8 }, () => PA_SEED.id), JEWEL.id,
    ]);
    expect(current().players[owner].remove).not.toContain(JEWEL.id);
  });
});

describe('official QA Wave167: B07034 simultaneous and face-down set-card leave', () => {
  it.each([
    ['source-first', true],
    ['host-first', false],
  ] as const)('%s batch keeps the simultaneous source observer for the sibling set leave', (_label, sourceFirst) => {
    let state = redMagicState();
    let sourceUid = '';
    let hostUid = '';
    state = produce(state, draft => {
      sourceUid = mutate.scene.enter(draft, 'self', B07034.id, {}).uid;
      const host = mutate.scene.enter(draft, 'self', HOST.id, {});
      hostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, false);
    });
    const before = state.players.self.hand.length;
    const queued = produce(state, draft => {
      mutate.scene.removeToRemoveBatch(
        draft,
        sourceFirst ? [sourceUid, hostUid] : [hostUid, sourceUid],
        'effect',
      );
    });
    expect(JSON.stringify(queued)).not.toContain('simultaneousSetCardObservers');
    expect(queued.pendingEffects.filter(entry => (
      entry.source.cardId === B07034.id && entry.source.abilityId === 'a1'
    ))).toHaveLength(1);
    const after = produce(queued, draft => {
      runAllUntilEmpty(draft);
    });

    expect(after.players.self.hand).toHaveLength(before + 1);
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual(expect.arrayContaining([B07034.id, HOST.id, SET_CARD.id]));
  });

  it('does not draw when an own face-up set card leaves', () => {
    let state = redMagicState();
    let hostUid = '';
    state = produce(state, draft => {
      mutate.scene.enter(draft, 'self', B07034.id, {});
      const host = mutate.scene.enter(draft, 'self', HOST.id, {});
      hostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, true);
    });
    const before = state.players.self.hand.length;
    const after = produce(state, draft => {
      mutate.scene.removeToRemove(draft, hostUid, 'effect');
      runAllUntilEmpty(draft);
    });

    expect(after.players.self.hand).toHaveLength(before);
    expect(after.players.self.remove).toEqual(expect.arrayContaining([HOST.id, SET_CARD.id]));
  });
});

function publicBatchState(
  card: CardDef,
  owner: Player,
  options: { sourceFirst: boolean; setCount: number; faceUp?: boolean },
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: BATCH_CASE.id, colors: ['赤'],
  };
  const source = sceneChar(card.id, 'source');
  const host = sceneChar(HOST.id, 'host');
  host.setCards = Array.from({ length: options.setCount }, (_, index) => ({
    cardId: index % 2 === 0 ? SET_CARD.id : SET_CARD_B.id,
    faceUp: options.faceUp === true,
    instanceId: `batch-set-${index}`,
  }));
  state.players[owner].scene = options.sourceFirst ? [source, host] : [host, source];
  state.players.self.deck = [DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  state.players.opp.deck = [DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave167: B07034/P public simultaneous removal', () => {
  it.each(B07034_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner may remove itself after setting its own face-down card and still draw',
    ({ card, owner }) => {
      // Card-bound physical rows: B07034 B07034P.
      const state = createEmptyGameState();
      state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = {
        ...state.players[owner].case, cardId: RED_MAGIC_CASE.id, colors: ['赤'],
      };
      state.players[owner].scene = [sceneChar(card.id, 'source', { state: 'active' })];
      state.players[owner].hand = [HAND_FODDER.id];
      state.players[owner].deck = [SET_CARD.id, DRAW.id, DRAW.id];
      state.players[other(owner)].deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-self-leave`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      choose(pendingPick(card.id, 'a2', 'sceneRemove'), 'source');

      expect(current().players[owner].scene).toHaveLength(0);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([
        HAND_FODDER.id, SET_CARD.id, card.id,
      ]));
      expect(current().players[owner].hand).toEqual([DRAW.id]);
    },
  );

  it.each(B07034_PRINTS.flatMap(card => (['self', 'opp'] as const).flatMap(owner => (
    [true, false].map(sourceFirst => ({ card, owner, sourceFirst }))
  ))))(
    '$card.id owner=$owner sourceFirst=$sourceFirst observes the sibling face-down set leave',
    ({ card, owner, sourceFirst }) => {
      // Card-bound physical rows: B07034 B07034P.
      const leaves: unknown[] = [];
      event.on('setcard:leave', (_state, payload) => { leaves.push(payload); });
      install(publicBatchState(card, owner, { sourceFirst, setCount: 1 }), owner, `${card.id}-${owner}-${sourceFirst}`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      expect(leaves).toHaveLength(1);
      const rawObservers = (leaves[0] as {
        simultaneousSetCardObservers?: Array<Record<string, unknown>>;
      }).simultaneousSetCardObservers;
      expect(rawObservers).toEqual([expect.objectContaining({
        player: owner, uid: 'source', cardId: card.id, abilityIndices: [0],
      })]);
      expect(JSON.stringify(rawObservers)).not.toContain('setCards');
      expect(JSON.stringify(rawObservers)).not.toContain(SET_CARD.id);
      expect(current().pendingEffects.filter(entry => (
        entry.source.cardId === card.id && entry.source.abilityId === 'a1'
      ))).toHaveLength(1);
      confirmOwnerOrder(owner);
      expect(current().players[owner].hand).toEqual([DRAW.id]);
      expect(current().players[owner].scene).toHaveLength(0);
      expect(JSON.stringify(current())).not.toContain('simultaneousSetCardObservers');
    },
  );

  it.each(B07034_PRINTS.flatMap(card => ([2, 3] as const).map(setCount => ({ card, setCount }))))(
    '$card.id draws twice for $setCount simultaneous face-down set leaves and respects Turn2',
    ({ card, setCount }) => {
      // Card-bound physical rows: B07034 B07034P.
      install(publicBatchState(card, 'self', { sourceFirst: false, setCount }), 'self', `${card.id}-count-${setCount}`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'case:self', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      confirmOwnerOrder('self');
      expect(current().players.self.hand).toEqual([DRAW.id, DRAW.id]);
      expect(current().players.self.remove.filter(cardId => (
        cardId === SET_CARD.id || cardId === SET_CARD_B.id
      ))).toHaveLength(setCount);
    },
  );

  it.each(B07034_PRINTS)('$id ignores an own face-up set leave on the public batch path', card => {
    // Card-bound physical rows: B07034 B07034P.
    install(publicBatchState(card, 'self', { sourceFirst: false, setCount: 1, faceUp: true }), 'self', `${card.id}-face-up`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([]);
  });
});

describe('official QA Wave167: B07039/P partner-area cost ownership', () => {
  it.each(B07039_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner spends only the owner jewel and draws one',
    ({ card, owner }) => {
      // Card-bound physical rows: B07039 B07039P.
      const state = createEmptyGameState();
      state.turn = { number: 167, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = { ...state.players[owner].case, status: '解決編' };
      state.players[owner].scene = [sceneChar(card.id, 'source')];
      state.players[owner].partnerAreaCards = [JEWEL.id];
      state.players[other(owner)].partnerAreaCards = [JEWEL.id];
      state.players.self.deck = [DRAW.id, DRAW.id];
      state.players.opp.deck = [DRAW.id, DRAW.id];
      install(state, owner, `${card.id}-${owner}-pa-owner`);
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1',
        abilityOrigin: 'printed', abilityIndex: 0,
        costParams: { partnerAreaRemove: { ids: [JEWEL.id] } },
      })).toEqual({ ok: true });

      expect(current().players[owner].partnerAreaCards).toEqual([]);
      expect(current().players[owner].remove).toContain(JEWEL.id);
      expect(current().players[owner].hand).toEqual([DRAW.id]);
      expect(current().players[other(owner)].partnerAreaCards).toEqual([JEWEL.id]);
    },
  );

  it.each(B07039_PRINTS)('$id rejects an opponent-only jewel without mutation', card => {
    // Card-bound physical rows: B07039 B07039P.
    const state = createEmptyGameState();
    state.turn = { number: 167, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case = { ...state.players.self.case, status: '解決編' };
    state.players.self.scene = [sceneChar(card.id, 'source')];
    state.players.opp.partnerAreaCards = [JEWEL.id];
    state.players.self.deck = [DRAW.id, DRAW.id];
    const before = JSON.stringify(state);
    install(state, 'self', `${card.id}-pa-negative`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
      costParams: { partnerAreaRemove: { ids: [JEWEL.id] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

describe('Wave167 simultaneous observer horizontal regressions', () => {
  it('honors one prior B07034 use, then permits exactly one of two detached batch leaves', () => {
    let state = redMagicState();
    let sourceUid = '';
    let firstHostUid = '';
    state = produce(state, draft => {
      sourceUid = mutate.scene.enter(draft, 'self', B07034.id, {}).uid;
      const host = mutate.scene.enter(draft, 'self', HOST.id, {});
      firstHostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, false);
    });
    state = produce(state, draft => {
      mutate.scene.removeToRemove(draft, firstHostUid, 'effect');
      runAllUntilEmpty(draft);
    });
    expect(state.players.self.hand).toEqual([DRAW.id]);

    let secondHostUid = '';
    state = produce(state, draft => {
      const host = mutate.scene.enter(draft, 'self', HOST_B.id, {});
      secondHostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, false);
      mutate.char.setCard(draft, host.uid, SET_CARD_B.id, false);
    });
    const after = produce(state, draft => {
      mutate.scene.removeToRemoveBatch(draft, [sourceUid, secondHostUid], 'effect');
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.hand).toEqual([DRAW.id, DRAW.id]);
  });

  it('queues one occurrence for each of two physical detached B07034 observers', () => {
    let state = redMagicState();
    let sourceA = '';
    let sourceB = '';
    let hostUid = '';
    state = produce(state, draft => {
      sourceA = mutate.scene.enter(draft, 'self', B07034.id, {}).uid;
      sourceB = mutate.scene.enter(draft, 'self', B07034P.id, {}).uid;
      const host = mutate.scene.enter(draft, 'self', HOST.id, {});
      hostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, false);
    });
    const queued = produce(state, draft => {
      mutate.scene.removeToRemoveBatch(draft, [sourceA, sourceB, hostUid], 'effect');
    });
    expect(queued.pendingEffects.filter(entry => (
      entry.source.abilityId === 'a1'
      && (entry.source.cardId === B07034.id || entry.source.cardId === B07034P.id)
    ))).toHaveLength(2);
    const after = produce(queued, draft => { runAllUntilEmpty(draft); });
    expect(after.players.self.hand).toEqual([DRAW.id, DRAW.id]);
  });

  it.each([B02020, B02020P])('$id remains an opposing-set observer when detached first', card => {
    const state = createEmptyGameState();
    state.turn = { number: 167, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    let sourceUid = '';
    let hostUid = '';
    const prepared = produce(state, draft => {
      sourceUid = mutate.scene.enter(draft, 'self', card.id, {}).uid;
      const host = mutate.scene.enter(draft, 'opp', HOST.id, {});
      hostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SET_CARD.id, false);
    });
    const queued = produce(prepared, draft => {
      mutate.scene.removeToRemoveBatch(draft, [sourceUid, hostUid], 'effect');
    });
    expect(queued.pendingEffects.filter(entry => (
      entry.source.cardId === card.id && entry.source.abilityId === 'a1'
    ))).toHaveLength(1);
  });

  it.each([PR234, PR240])('$id remains a face-up named-set observer when detached first', card => {
    const state = createEmptyGameState();
    state.turn = { number: 167, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    let sourceUid = '';
    let hostUid = '';
    const prepared = produce(state, draft => {
      sourceUid = mutate.scene.enter(draft, 'self', card.id, {}).uid;
      const host = mutate.scene.enter(draft, 'self', HOST.id, {});
      hostUid = host.uid;
      mutate.char.setCard(draft, host.uid, SHUFFLE_ROMANCE.id, true);
    });
    const queued = produce(prepared, draft => {
      mutate.scene.removeToRemoveBatch(draft, [sourceUid, hostUid], 'effect');
    });
    expect(queued.pendingEffects.filter(entry => (
      entry.source.cardId === card.id && entry.source.abilityId === 'a2'
    ))).toHaveLength(1);
  });
});
