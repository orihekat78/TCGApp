// qa: card:B08067:39697486128060cc69b3013afbfa63811801fc44ee3420780fc81d03aeb87e02
// qa: card:B08069:66d562d548cfae6ef0b05e52e9b47342a90fe80ad7ca9cba6d11aa0c13cb50f0
// qa: card:B08071:c0f4cd95060c88085c7f86d32ef9454b6c0f21aebfa3c5634a6249fe0058c5c8
// qa: card:B08072:8eadbbc432ff0b12ab5d701819788dee01eac2e8fdd17d8439daa8cd5f5a1167
// qa: card:B08072:fe200fa87639fad66be77335cd98bb1639dfd8cf8e7f1fd958a5c4d6b563bc33
// qa: card:B08073:07cb3dce14db037f0fdc6b48f004f51662710f9ac5fdec1828e791e6672fb7f0
// qa: card:B08073:2b2af443366f34fc4624feaaf86722c8e23813be84ac5d951b7086cb8f9c3b58
// qa: card:B08073:33ee144ebb5fb91b5a4714cc066bce3624f387d0ef38a4b489ab03b1a3b60987
// qa: card:B08073:d538f5ad89d4676ce15195e9a30094641630abe145daae30ef622c77c154eb3b

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07079 } from '@/cards/ct-p07/B07079';
import { B08062 } from '@/cards/ct-p08/B08062';
import { B08067 } from '@/cards/ct-p08/B08067';
import { B08069 } from '@/cards/ct-p08/B08069';
import { B08071 } from '@/cards/ct-p08/B08071';
import { B08072 } from '@/cards/ct-p08/B08072';
import { B08073 } from '@/cards/ct-p08/B08073';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import {
  _resetReservedEffectsRegistered,
  registerReservedEffectListener,
} from '@/engine/listeners/reserved-effects';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
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

const YELLOW_PARTNER = fixture('W183_YELLOW_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const NAGANO_A = fixture('W183_NAGANO_A', { names: ['長野A'], traits: ['長野県警'], level: 3 });
const NAGANO_B = fixture('W183_NAGANO_B', { names: ['長野B'], traits: ['長野県警'], level: 4 });
const NAGANO_A_DUP = fixture('W183_NAGANO_A_DUP', { names: ['長野A'], traits: ['長野県警'], level: 2 });
const SATO = fixture('W183_SATO', { names: ['佐藤美和子'], traits: ['警察', '警視庁'], level: 4, ap: 3000 });
const TAKAGI = fixture('W183_TAKAGI', { names: ['高木渉'], traits: ['警察', '警視庁'], level: 4, ap: 4000 });
const NON_SATO = fixture('W183_NON_SATO', { names: ['千葉和伸'], traits: ['警察'], level: 4, ap: 3000 });
const NON_NAME = fixture('W183_NON_NAME', { names: ['邪魔者'], traits: ['警察'], level: 3, ap: 2000 });
const COP_A = fixture('W183_COP_A', { names: ['警察A'], traits: ['警察'], level: 4 });
const COP_B = fixture('W183_COP_B', { names: ['警察B'], traits: ['警察'], level: 4 });
const LEVEL_SEVEN = fixture('W183_LEVEL_SEVEN', { colors: ['青'], level: 7, ap: 5000 });
const AP_SIX_THOUSAND = fixture('W183_AP_SIX_THOUSAND', { colors: ['青'], ap: 6000 });
const AP_SIX_THOUSAND_ONE = fixture('W183_AP_SIX_THOUSAND_ONE', { colors: ['青'], ap: 6001 });
const CONTACT_TARGET = fixture('W183_CONTACT_TARGET', { colors: ['青'], ap: 5000 });
const FILLER = fixture('W183_FILLER', { kind: 'event' });
const DRAW_CARD = fixture('W183_DRAW_CARD', { kind: 'event' });
const END_REMOVE = fixture('W183_END_REMOVE', {
  names: ['佐藤美和子'], traits: ['警察'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'phase:end:start' },
    condition: { kind: 'turn', player: 'self' },
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'self', filter: { cardName: '邪魔者' }, cause: 'effect' },
    },
    description: 'At turn end, remove the named decoy.', ruleRefs: [],
  }],
});
const FIXTURES = [
  YELLOW_PARTNER, NAGANO_A, NAGANO_B, NAGANO_A_DUP, SATO, TAKAGI,
  NON_SATO, NON_NAME, COP_A, COP_B, LEVEL_SEVEN, AP_SIX_THOUSAND,
  AP_SIX_THOUSAND_ONE, CONTACT_TARGET, FILLER, DRAW_CARD, END_REMOVE,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave183 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave183-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function chooseCard(pending: PendingPick, cardId: string | null): void {
  const pickedUid = cardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === cardId)?.uid;
  if (cardId !== null) expect(pickedUid, `${cardId} must be selectable`).toBeTruthy();
  choose(pending, pickedUid ?? null);
}

function reachOwnerContact(owner: Player, actorUid: string, targetUid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: actorUid, targetUid }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  const action = flow.action._getContext(current(), actionId)!;
  const firstPlayer: Player = current().players.self.scene.some(character => character.uid === action.firstUid)
    ? 'self'
    : 'opp';
  if (firstPlayer !== owner) {
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: firstPlayer, choice: { kind: 'pass' },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  return actionId;
}

function orderAndResolve(owner: Player, firstCardId: string): void {
  const group = pendingOwnerOrderGroup(current(), owner);
  const first = group.find(entry => entry.source.cardId === firstCardId);
  expect(first).toBeDefined();
  expect(dispatchEngineAction({
    type: 'setEffectOrder', entryId: first!.id, order: 0, player: owner,
  })).toEqual({ ok: true });
  const ordered = pendingOwnerOrderGroup(current(), owner);
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id),
  })).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  registerReservedEffectListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave183: B08067 entrant counts itself', () => {
  it.each(['self', 'opp'] as const)('owner=%s reaches three distinct Nagano names only with the entrant itself', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].case.status = '解決編';
    state.players[owner].file = fileCards(5);
    state.players[owner].partner.cardId = YELLOW_PARTNER.id;
    state.players[owner].hand = [B08067.id];
    state.players[owner].scene = [sceneChar(NAGANO_A.id, 'nagano-a'), sceneChar(NAGANO_B.id, 'nagano-b')];
    state.players[opponent].scene = [sceneChar(LEVEL_SEVEN.id, 'target')];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08067-self-count`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08067.id }))
      .toEqual({ ok: true });
    const pick = pendingPick(B08067.id, 'a1', 'sceneRemove');
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('target');
    choose(pick, null);

    const duplicate = createEmptyGameState();
    duplicate.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    duplicate.players[owner].case.colors = ['黄'];
    duplicate.players[owner].case.status = '解決編';
    duplicate.players[owner].file = fileCards(5);
    duplicate.players[owner].partner.cardId = YELLOW_PARTNER.id;
    duplicate.players[owner].hand = [B08067.id];
    duplicate.players[owner].scene = [sceneChar(NAGANO_A.id, 'same-a'), sceneChar(NAGANO_A_DUP.id, 'same-b')];
    duplicate.players[opponent].scene = [sceneChar(LEVEL_SEVEN.id, 'target')];
    duplicate.players[owner].deck = [FILLER.id, FILLER.id];
    install(duplicate, owner, `${owner}-B08067-duplicate-name`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08067.id }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[opponent].scene.some(character => character.uid === 'target')).toBe(true);
  });
});

describe('official QA Wave183: B08069 reserves one effect per physical declaration', () => {
  it.each(['self', 'opp'] as const)('owner=%s resolves two independently reserved turn-end entries', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08069.id, 'kazami-a'), sceneChar(B08069.id, 'kazami-b')];
    state.players[owner].hand = [COP_A.id, COP_B.id];
    state.players[owner].deck = [FILLER.id];
    install(state, owner, `${owner}-B08069-double-reserve`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazami-a', abilId: 'a1' }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazami-b', abilId: 'a1' }))
      .toEqual({ ok: true });
    expect(current().reservedEffects).toHaveLength(2);
    expect(new Set(current().reservedEffects.map(entry => entry.id)).size).toBe(2);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(pendingOwnerOrderGroup(current(), owner)).toHaveLength(2);
    orderAndResolve(owner, B08069.id);
    chooseCard(pendingPick(B08069.id, 'a1', 'sceneEnter'), COP_A.id);
    chooseCard(pendingPick(B08069.id, 'a1', 'sceneEnter'), COP_B.id);

    expect(current().players[owner].scene.map(character => character.cardId))
      .toEqual(expect.arrayContaining([COP_A.id, COP_B.id]));
    expect(current().reservedEffects).toEqual([]);
  });
});

describe('official QA Wave183: B08071 non-Sato Cut-In remains usable', () => {
  it.each([
    ['self', NON_SATO, false], ['self', SATO, true],
    ['opp', NON_SATO, false], ['opp', SATO, true],
  ] as const)('owner=%s contact=$1.id applies AP while draw=$2', (owner, actor, draws) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(actor.id, 'actor')];
    state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'target', { state: 'sleep' })];
    state.players[owner].hand = [B08071.id];
    state.players[owner].deck = [DRAW_CARD.id, FILLER.id];
    install(state, owner, `${owner}-B08071-${actor.id}`);
    const beforeAP = read.char.ap(current(), 'actor');
    const beforeHand = current().players[owner].hand.length;

    const actionId = reachOwnerContact(owner, 'actor', 'target');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner,
      choice: { kind: 'cutin', cardId: B08071.id },
    })).toEqual({ ok: true });

    expect(read.char.ap(current(), 'actor')).toBe(beforeAP + 1000);
    expect(current().players[owner].remove).toContain(B08071.id);
    expect(current().players[owner].hand.length).toBe(beforeHand - 1 + (draws ? 1 : 0));
    expect(current().players[owner].hand.includes(DRAW_CARD.id)).toBe(draws);
  });
});

describe('official QA Wave183: B08072 resolves current AP and split names', () => {
  it.each(['self', 'opp'] as const)('owner=%s uses the live B08062 aura for the AP removal boundary', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].case.status = '解決編';
    state.players[owner].file = fileCards(5);
    state.players[owner].partnerAreaMR = {
      cardId: B08062.id, uid: `partnerMR:${owner}`, state: 'active',
    } as GameState['players'][Player]['partnerAreaMR'];
    state.players[owner].hand = [B08072.id];
    state.players[owner].scene = [sceneChar(TAKAGI.id, 'takagi')];
    state.players[opponent].scene = [
      sceneChar(AP_SIX_THOUSAND.id, 'ap6000'),
      sceneChar(AP_SIX_THOUSAND_ONE.id, 'ap6001'),
    ];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08072-live-ap`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08072.id }))
      .toEqual({ ok: true });
    const entered = current().players[owner].scene.find(character => character.cardId === B08072.id)!;
    expect(read.char.ap(current(), entered.uid)).toBe(6000);
    const pick = pendingPick(B08072.id, 'a1', 'sceneRemove');
    expect(pick.candidates.map(candidate => candidate.uid)).toContain('ap6000');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('ap6001');
    choose(pick, null);
  });

  it.each(['self', 'opp'] as const)('owner=%s treats Sato-Miyamoto as Sato in the all-name condition', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].case.status = '解決編';
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [B08072.id];
    state.players[owner].scene = [sceneChar(B07079.id, 'sato-miyamoto'), sceneChar(TAKAGI.id, 'takagi')];
    state.players[opponent].scene = [sceneChar(LEVEL_SEVEN.id, 'target')];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08072-split-name`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08072.id }))
      .toEqual({ ok: true });
    expect(pendingPick(B08072.id, 'a1', 'sceneRemove').candidates.map(candidate => candidate.uid))
      .toContain('target');
  });

  it('fails the all-name condition when a nonmatching own decoy is present', () => {
    const state = createEmptyGameState();
    state.turn = { number: 183, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['黄'];
    state.players.self.case.status = '解決編';
    state.players.self.file = fileCards(5);
    state.players.self.hand = [B08072.id];
    state.players.self.scene = [
      sceneChar(B07079.id, 'sato-miyamoto'), sceneChar(TAKAGI.id, 'takagi'), sceneChar(NON_NAME.id, 'decoy'),
    ];
    state.players.opp.scene = [sceneChar(LEVEL_SEVEN.id, 'target')];
    state.players.self.deck = [FILLER.id, FILLER.id];
    install(state, 'self', 'B08072-name-decoy');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08072.id }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave183: B08073 trigger-time and resolution-time gates', () => {
  it.each(['self', 'opp'] as const)('owner=%s does not retroactively trigger after a reserved effect enters Sato', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B08073.id, 'takagi-source', { state: 'sleep' }),
      sceneChar(B08069.id, 'kazami'),
    ];
    state.players[owner].hand = [SATO.id];
    state.players[owner].deck = [FILLER.id];
    install(state, owner, `${owner}-B08073-no-retroactive`);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazami', abilId: 'a1' }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    chooseCard(pendingPick(B08069.id, 'a1', 'sceneEnter'), SATO.id);

    expect(current().players[owner].scene.some(character => character.cardId === SATO.id)).toBe(true);
    expect(current().players[owner].scene.find(character => character.uid === 'takagi-source')?.state).toBe('sleep');
    expect(current().pendingEffects.some(entry => entry.source.cardId === B08073.id)).toBe(false);
  });

  it.each(['self', 'opp'] as const)('owner=%s mandatorily activates with Sato-Miyamoto satisfying both gates', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 183, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B08073.id, 'takagi-source', { state: 'sleep' }),
      sceneChar(B07079.id, 'sato-miyamoto'),
    ];
    install(state, owner, `${owner}-B08073-mandatory`);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'takagi-source')?.state).toBe('active');
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('rechecks the all-name condition after an earlier turn-end effect removes the decoy', () => {
    const state = createEmptyGameState();
    state.turn = { number: 183, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08073.id, 'takagi-source', { state: 'sleep' }),
      sceneChar(END_REMOVE.id, 'sato-remover'),
      sceneChar(NON_NAME.id, 'decoy'),
    ];
    install(state, 'self', 'B08073-resolution-recheck');

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(pendingOwnerOrderGroup(current(), 'self')).toHaveLength(2);
    orderAndResolve('self', END_REMOVE.id);
    chooseCard(pendingPick(END_REMOVE.id, 'a1', 'sceneRemove'), NON_NAME.id);

    expect(current().players.self.scene.some(character => character.uid === 'decoy')).toBe(false);
    expect(current().players.self.scene.find(character => character.uid === 'takagi-source')?.state).toBe('active');
  });
});
