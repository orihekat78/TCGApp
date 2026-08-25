// qa: card:B07043:2936447fd71a80eedcaab6991807eb457d313818936c6e73c803d98f0b0c0ed5
// qa: card:B07043:ccc7d4dcc95cfa86e076541c7a1ef1c3e3ad9784b7d28495ce88f0647cdac1f5
// qa: card:B07043:e6c826386ff01a7b0b104dc4409261f05cca204fb433686a0170faf9c5c42173
// qa: card:B07044:5f731874760d0bc0135bb404f430aadf50517c003bcfdc74b170b4d678f9d2b7
// qa: card:B07046:c758369a7dddc50cdfaf7333ed60a91e5c9ad6e42a67f2f798a59018a06e92d6
// qa: card:B07047:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4
// qa: card:B07048:b28b7e81f684a02f22f62ec571f745928832a0832a16216b7f2c8646fe2fb9b7
// qa: card:B07050:c680d5aa9a172825fa6d3f23d80458f9de6837d629d576726f564a5fe60fd2cd
// qa: card:B07051:81ca9d0c5d233174bf01264f196d510093f955d83f34d6820d51b61c7c0115ea

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05045 } from '@/cards/ct-p05/B05045';
import { B07030 } from '@/cards/ct-p07/B07030';
import { B07043 } from '@/cards/ct-p07/B07043';
import { B07044 } from '@/cards/ct-p07/B07044';
import { B07046 } from '@/cards/ct-p07/B07046';
import { B07047 } from '@/cards/ct-p07/B07047';
import { B07047P } from '@/cards/ct-p07/B07047P';
import { B07048 } from '@/cards/ct-p07/B07048';
import { B07050 } from '@/cards/ct-p07/B07050';
import { B07051 } from '@/cards/ct-p07/B07051';
import { B07059 } from '@/cards/ct-p07/B07059';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { canAction } from '@/engine/flow/main/action';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const WHITE_PARTNER = fixture('W168_WHITE_PARTNER', { kind: 'partner', level: undefined, ap: undefined, lp: 1 });
const RED_MAGIC_CASE = fixture('W168_RED_MAGIC_CASE', { kind: 'case', level: undefined, ap: undefined, lp: undefined, traits: ['赤魔術'] });
const PLAIN_CASE = fixture('W168_PLAIN_CASE', { kind: 'case', level: undefined, ap: undefined, lp: undefined });
const ATTACKER = fixture('W168_ATTACKER', { ap: 9000 });
const MAGICIAN = fixture('W168_MAGICIAN', { ap: 2000, traits: ['マジシャン'] });
const PLAIN = fixture('W168_PLAIN', { ap: 2000 });
const KOIZUMI = fixture('W168_KOIZUMI', { names: ['小泉紅子'], ap: 2000 });
const DECOY = fixture('W168_DECOY', { kind: 'event' });
const TAIL = fixture('W168_TAIL', { kind: 'event' });
const SET_A = fixture('W168_SET_A', { kind: 'event' });
const SET_B = fixture('W168_SET_B', { kind: 'event' });
const OPP_SET_A = fixture('W168_OPP_SET_A', { kind: 'event' });
const OPP_SET_B = fixture('W168_OPP_SET_B', { kind: 'event' });
const HAND = fixture('W168_HAND', { kind: 'event' });
const DRAW = fixture('W168_DRAW', { kind: 'event' });
const REFRESH = fixture('W168_REFRESH', { kind: 'event' });
const FIXTURES = [
  WHITE_PARTNER, RED_MAGIC_CASE, PLAIN_CASE, ATTACKER, MAGICIAN, PLAIN, KOIZUMI,
  DECOY, TAIL, SET_A, SET_B, OPP_SET_A, OPP_SET_B, HAND, DRAW, REFRESH,
];
const B07047_PRINTS = [B07047, B07047P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave168 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave168-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid })))
    .toEqual({ ok: true });
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

function b07043State(owner: Player, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 168, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(B07043.id, 'source', { state: 'sleep' })];
  state.players[other(owner)].scene = [sceneChar(ATTACKER.id, 'attacker', { state: 'active' })];
  state.players[owner].deck = [...deck];
  return state;
}

function removeB07043(owner: Player): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: owner, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: other(owner), choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function chooseKaitoName(owner: Player): void {
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice).toMatchObject({ player: owner, source: { cardId: B07043.id, abilityId: 'a1' } });
  expect(choice?.options.map(option => option.label)).toEqual(['黒羽盗一', '黒羽快斗', '怪盗キッド']);
  expect(dispatchEngineAction(bindPendingDecision(choice!, { type: 'choiceResolve', choiceIndex: 1 })))
    .toEqual({ ok: true });
}

describe('official QA Wave168: B07043 forced reveal-until', () => {
  it.each([
    { owner: 'self' as const, matchId: B05045.id, secondMatchId: B07030.id },
    { owner: 'opp' as const, matchId: B07030.id, secondMatchId: B05045.id },
  ])('owner=$owner treats $matchId as Kaito and must add the first match', ({ owner, matchId, secondMatchId }) => {
    install(b07043State(owner, [DECOY.id, matchId, secondMatchId, TAIL.id]), owner, `${owner}-split-name`);
    removeB07043(owner);
    chooseKaitoName(owner);

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all',
      revealed: [DECOY.id, matchId], matched: matchId,
      source: { cardId: B07043.id, abilityId: 'a1' },
    });
    expect(current().players[owner].hand).toEqual([matchId]);
    expect([...current().players[owner].deck].sort()).toEqual([DECOY.id, secondMatchId, TAIL.id].sort());
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s returns every no-match reveal before shuffling', owner => {
    install(b07043State(owner, [DECOY.id, TAIL.id]), owner, `${owner}-no-match`);
    removeB07043(owner);
    chooseKaitoName(owner);

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, revealed: [DECOY.id, TAIL.id], matched: null,
    });
    expect(current().players[owner].hand).toEqual([]);
    expect([...current().players[owner].deck].sort()).toEqual([DECOY.id, TAIL.id].sort());
    expect(current().refreshCount[owner]).toBe(0);
    expect(current().players[other(owner)].evidence).toEqual([]);
    const actions = current().log.map(entry => entry.action);
    expect(actions.lastIndexOf('effect:deckShuffle')).toBeGreaterThan(actions.lastIndexOf('effect:deckToBottomBound'));
  });
});

describe('official QA Wave168: continuous modifiers', () => {
  it.each(['self', 'opp'] as const)('B07044 owner=%s buffs every other own Magician and no other card', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 168, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B07044.id, 'jodie-a'), sceneChar(B07044.id, 'jodie-b'),
      sceneChar(MAGICIAN.id, 'magician'), sceneChar(PLAIN.id, 'plain'),
    ];
    state.players[other(owner)].scene = [sceneChar(MAGICIAN.id, 'opponent-magician')];

    expect(read.char.ap(state, 'jodie-a')).toBe(7000);
    expect(read.char.ap(state, 'jodie-b')).toBe(7000);
    expect(read.char.ap(state, 'magician')).toBe(4000);
    expect(read.char.ap(state, 'plain')).toBe(2000);
    expect(read.char.ap(state, 'opponent-magician')).toBe(2000);
  });

  it.each(['self', 'opp'] as const)('B07046 owner=%s counts only own Big Jewels and expires off-turn', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 168, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07046.id, 'doron', { state: 'sleep' })];
    state.players[owner].partnerAreaCards = [B07059.id, DECOY.id, B07059.id];
    state.players[other(owner)].partnerAreaCards = [B07059.id, B07059.id, B07059.id];
    expect(read.char.ap(state, 'doron')).toBe(7000);
    state.players[owner].scene[0]!.state = 'stun';
    expect(read.char.ap(state, 'doron')).toBe(7000);
    state.turn.player = other(owner);
    expect(read.char.ap(state, 'doron')).toBe(5000);
  });
});

describe('official QA Wave168: B07047/P Red Magic case gate', () => {
  it.each(B07047_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner has Assault only while its own case has Red Magic',
    ({ card, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 168, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'ginzo', { state: 'active', isNamed: true })];
      state.players[owner].case = { ...state.players[owner].case, cardId: PLAIN_CASE.id };
      expect(read.char.keywords(state, 'ginzo')).not.toContain('突撃');
      expect(canAction(state, 'ginzo')).toBe(false);
      state.players[owner].case.cardId = RED_MAGIC_CASE.id;
      expect(read.char.keywords(state, 'ginzo')).toContain('突撃');
      expect(canAction(state, 'ginzo')).toBe(true);
      expect(read.char.keywords(state, 'ginzo')).not.toContain('突撃[キャラ]');
    },
  );
});

function setHost(cardId: string, uid: string, setId: string, instanceId: string) {
  const host = sceneChar(cardId, uid);
  host.setCards = [{ cardId: setId, faceUp: false, instanceId }];
  return host;
}

function b07048State(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 168, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].scene = [
    sceneChar(B07048.id, 'source', { state: 'active' }),
    setHost(PLAIN.id, 'own-a', SET_A.id, 'own-set-a'),
    setHost(MAGICIAN.id, 'own-b', SET_B.id, 'own-set-b'),
  ];
  state.players[other(owner)].scene = [
    setHost(PLAIN.id, 'opp-a', OPP_SET_A.id, 'opp-set-a'),
    setHost(MAGICIAN.id, 'opp-b', OPP_SET_B.id, 'opp-set-b'),
  ];
  state.players[owner].hand = [HAND.id];
  state.players[owner].deck = [DRAW.id, DRAW.id];
  return state;
}

describe('official QA Wave168: B07048 set-card cost ownership', () => {
  it.each(['self', 'opp'] as const)('owner=%s pays two own physical set occurrences', owner => {
    install(b07048State(owner), owner, `${owner}-own-set-cost`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeSetCard: { hostUids: ['own-a', 'own-b'], instanceIds: ['own-set-a', 'own-set-b'] } },
    })).toEqual({ ok: true });

    expect(current().players[owner].scene.find(character => character.uid === 'own-a')?.setCards).toEqual([]);
    expect(current().players[owner].scene.find(character => character.uid === 'own-b')?.setCards).toEqual([]);
    expect(current().players[other(owner)].scene.every(character => character.setCards.length === 1)).toBe(true);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([SET_A.id, SET_B.id]));
    const discard = pendingPick(B07048.id, 'a2', 'discard');
    choose(discard, discard.candidates[0]!.uid);
  });

  it.each(['self', 'opp'] as const)('owner=%s rejects opponent set occurrences without mutation', owner => {
    const state = b07048State(owner);
    install(state, owner, `${owner}-opponent-set-cost`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeSetCard: { hostUids: ['opp-a', 'opp-b'], instanceIds: ['opp-set-a', 'opp-set-b'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

function contactState(owner: Player, targetCardId: string, guardCardId: string): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 168, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(targetCardId, 'target', { state: 'sleep' }),
    sceneChar(guardCardId, 'guard', { state: 'active' }),
  ];
  state.players[owner].hand = [B07050.id];
  state.players[other(owner)].scene = [sceneChar(ATTACKER.id, 'attacker', { state: 'active' })];
  return state;
}

function reachGuardWindow(owner: Player): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guard' })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave168 contact ended before guard window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
      if (player === owner && uid === 'guard') return actionId;
      expect(dispatchEngineAction({ type: 'actionContact', actionId, player, choice: { kind: 'pass' } }))
        .toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave168 guard window not reached');
}

function runB07050Cutin(owner: Player, targetCardId: string, guardCardId: string, delta: number, label: string): void {
  install(contactState(owner, targetCardId, guardCardId), owner, `${owner}-${label}`);
  const actionId = reachGuardWindow(owner);
  const before = read.char.ap(current(), 'guard');
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: B07050.id },
  })).toEqual({ ok: true });
  expect(read.char.ap(current(), 'guard')).toBe(before + delta);
}

describe('official QA Wave168: B07050 checks the current contact character', () => {
  it.each(['self', 'opp'] as const)('owner=%s uses +1000 when Koizumi was targeted but a different guard contacts', owner => {
    runB07050Cutin(owner, KOIZUMI.id, PLAIN.id, 1000, 'target-only-koizumi');
    runB07050Cutin(owner, PLAIN.id, KOIZUMI.id, 3000, 'guard-koizumi-control');
  });
});

describe('official QA Wave168: B07051 last-card reveal precedes refresh', () => {
  it.each(['self', 'opp'] as const)('owner=%s reveals and takes the sole card, then refreshes', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 168, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07051.id, 'source', { state: 'active' })];
    state.players[owner].deck = [B05045.id];
    state.players[owner].remove = [REFRESH.id];
    install(state, owner, `${owner}-last-card`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all', revealed: [B05045.id], matched: B05045.id,
      source: { cardId: B07051.id, abilityId: 'a1' },
    });
    expect(current().players[owner].hand).toContain(B05045.id);
    expect(current().players[owner].deck).toEqual([REFRESH.id]);
    expect(current().players[owner].remove).toEqual([]);
    expect(current().refreshCount[owner]).toBe(1);
    expect(current().players[other(owner)].evidence).toHaveLength(1);
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state).toBe('sleep');
  });
});
