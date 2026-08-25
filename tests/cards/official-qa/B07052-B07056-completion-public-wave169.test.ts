// qa: card:B07052:6f98c3d7a03fcea61db5d9ae93b0a97ce83fd44eb79a4179dfe5b3072986d55a
// qa: card:B07052:789049b9d2880459669d430a17e448773f634fb20994dacac7767fba2c85d6a0
// qa: card:B07053:036ecf3e2ce95bd79759bb2c5bf1847274ac70d1b390dcb57a7b47ab7013304c
// qa: card:B07053:7ce0d31df5ea2d710918e2ea0d7a375d03e86245d2a2ebd28b657a05f528cc69
// qa: card:B07053:ae3ba03b8b92733451c35ed583ca9fa4bd2f00188c6d89a608d01f29e89dbe17
// qa: card:B07055:3bbd1d1b862db20515ace88f7b77bb80a1e73060ca14fb51e01c6ef2419444d4
// qa: card:B07055:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4
// qa: card:B07055:f132117a4178054cd112443bbafd18e4bf92a6781667e308e01f42075be71ee1
// qa: card:B07056:114d0e7421b2c0c3dd09027e13c786a64f7c9b0258d7a547ce63e2f9714dad1e

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05045 } from '@/cards/ct-p05/B05045';
import { B07052 } from '@/cards/ct-p07/B07052';
import { B07053 } from '@/cards/ct-p07/B07053';
import { B07055 } from '@/cards/ct-p07/B07055';
import { B07055P } from '@/cards/ct-p07/B07055P';
import { B07056 } from '@/cards/ct-p07/B07056';
import { B07056P } from '@/cards/ct-p07/B07056P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
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

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const WHITE_PARTNER = fixture('W169_WHITE_PARTNER', { kind: 'partner', level: undefined, ap: undefined, lp: 1 });
const RED_MAGIC_CASE = fixture('W169_RED_MAGIC_CASE', { kind: 'case', level: undefined, ap: undefined, lp: undefined, traits: ['赤魔術'] });
const PLAIN_CASE = fixture('W169_PLAIN_CASE', { kind: 'case', level: undefined, ap: undefined, lp: undefined });
const DECOY_CHAR = fixture('W169_DECOY_CHAR');
const DECOY_EVENT = fixture('W169_DECOY_EVENT', { kind: 'event' });
const TAIL = fixture('W169_TAIL', { kind: 'event' });
const SEARCHER = fixture('W169_SEARCHER', {
  abilities: [
    {
      id: 'remove', type: 'declared', scope: 'on-scene',
      effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '怪盗キッド', kind: 'character' } } },
      description: 'Find a printed Kid in remove.', ruleRefs: ['rules/15-abilities-effects.md'],
    },
    {
      id: 'deck', type: 'declared', scope: 'on-scene',
      effect: { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', visibility: 'public', viewer: 'all', maxN: 2, filter: { cardName: '怪盗キッド', kind: 'character' } } },
      description: 'Reveal through a printed Kid in deck.', ruleRefs: ['rules/15-abilities-effects.md'],
    },
  ] as AbilityDef[],
});
const HOST_A = fixture('W169_HOST_A', { ap: 9000 });
const HOST_B = fixture('W169_HOST_B', { ap: 9000 });
const SET_A = fixture('W169_SET_A', { kind: 'event' });
const SET_B = fixture('W169_SET_B', { kind: 'event' });
const OPP_SET = fixture('W169_OPP_SET', { kind: 'event' });
const AP8000 = fixture('W169_AP8000', { ap: 8000 });
const AP6000 = fixture('W169_AP6000', { ap: 6000 });
const AP8001 = fixture('W169_AP8001', { ap: 8001 });
const KOIZUMI = fixture('W169_KOIZUMI', { names: ['小泉紅子'] });
const FIXTURES = [
  WHITE_PARTNER, RED_MAGIC_CASE, PLAIN_CASE, DECOY_CHAR, DECOY_EVENT, TAIL,
  SEARCHER, HOST_A, HOST_B, SET_A, SET_B, OPP_SET, AP8000, AP6000, AP8001, KOIZUMI,
];
const B07055_PRINTS = [B07055, B07055P] as const;
const B07056_PRINTS = [B07056, B07056P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const }));
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave169 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave169-${label}`);
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
    type: 'effectPickResolve', pickedUid, ...(pickedUids ? { pickedUids } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
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

function b07052State(owner: Player, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = { ...state.players[owner].case, cardId: PLAIN_CASE.id, colors: ['白'] };
  state.players[owner].file = fileCards(8);
  state.players[owner].hand = [B07052.id];
  state.players[owner].deck = [...deck];
  return state;
}

describe('official QA Wave169: B07052 forced Red Magic reveal', () => {
  it.each(['self', 'opp'] as const)('owner=%s keeps every no-match reveal and shuffles', owner => {
    install(b07052State(owner, [DECOY_CHAR.id, DECOY_EVENT.id]), owner, `${owner}-no-match`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07052.id }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'public', viewer: 'all',
      revealed: [DECOY_CHAR.id, DECOY_EVENT.id], matched: null,
      source: { cardId: B07052.id, abilityId: 'a2' },
    });
    expect(current().players[owner].hand).toEqual([]);
    expect([...current().players[owner].deck].sort()).toEqual([DECOY_CHAR.id, DECOY_EVENT.id].sort());
    expect(current().refreshCount[owner]).toBe(0);
    const actions = current().log.map(entry => entry.action);
    expect(actions.lastIndexOf('effect:deckShuffle')).toBeGreaterThan(actions.lastIndexOf('effect:deckToBottomBound'));
  });

  it.each(['self', 'opp'] as const)('owner=%s must take the first Red Magic event only', owner => {
    install(b07052State(owner, [DECOY_CHAR.id, DECOY_EVENT.id, B07055.id, B07055P.id]), owner, `${owner}-first-match`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07052.id }))
      .toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, revealed: [DECOY_CHAR.id, DECOY_EVENT.id, B07055.id], matched: B07055.id,
    });
    expect(current().players[owner].hand).toEqual([B07055.id]);
    expect(current().players[owner].deck).toContain(B07055P.id);
    expect(current().players[owner].deck).not.toContain(B07055.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave169: B07053 name scope', () => {
  it.each(['self', 'opp'] as const)('owner=%s grants Kid only in scene and preserves the printed name', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B07053.id, 'robot')];
    expect(read.char.names(state, 'robot')).toEqual(['ロボット黒羽快斗', '怪盗キッド']);

    state.players[owner].scene = [sceneChar(SEARCHER.id, 'searcher')];
    state.players[owner].remove = [B07053.id, B05045.id];
    install(state, owner, `${owner}-remove-name-scope`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'searcher', abilId: 'remove', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    const removePick = pendingPick(SEARCHER.id, 'remove', 'handAddFromRemove');
    expect(removePick.candidates.map(candidate => candidate.cardId)).toEqual([B05045.id]);

    const deckState = createEmptyGameState();
    deckState.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    deckState.players[owner].scene = [sceneChar(SEARCHER.id, 'searcher')];
    deckState.players[owner].deck = [B07053.id, B05045.id, TAIL.id];
    install(deckState, owner, `${owner}-deck-name-scope`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'searcher', abilId: 'deck', abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, revealed: [B07053.id, B05045.id], matched: B05045.id,
    });
  });
});

function b07053EntryState(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = fileCards(5);
  state.players[owner].hand = [B07053.id, B05045.id];
  state.players[owner].deck = [TAIL.id];
  return state;
}

describe('official QA Wave169: B07053 reveal visibility lifetime', () => {
  it.each(['self', 'opp'] as const)('owner=%s publicly reveals the chosen card, then may hide it after resolution', owner => {
    install(b07053EntryState(owner), owner, `${owner}-public-reveal`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07053.id }))
      .toEqual({ ok: true });
    const revealPick = pendingPick(B07053.id, 'a2', 'handReveal');
    const target = revealPick.candidates.find(candidate => candidate.cardId === B05045.id)!;
    choose(revealPick, target.uid);
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, audience: 'all', cardIds: [B05045.id], handSnapshot: [B05045.id],
      lifetime: 'presentation', source: { cardId: B07053.id, abilityId: 'a2' },
    });
    expect(current().players[owner].hand).toEqual([B05045.id]);
    const robot = current().players[owner].scene.find(character => character.cardId === B07053.id)!;
    expect(read.char.keywords(current(), robot.uid)).toContain('突撃');

    useGameStateStore.getState().setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s may decline without revealing or gaining Assault', owner => {
    install(b07053EntryState(owner), owner, `${owner}-decline-reveal`);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B07053.id }))
      .toEqual({ ok: true });
    choose(pendingPick(B07053.id, 'a2', 'handReveal'), null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    const robot = current().players[owner].scene.find(character => character.cardId === B07053.id)!;
    expect(read.char.keywords(current(), robot.uid)).not.toContain('突撃');
  });
});

function setHost(cardId: string, uid: string, setCardId: string, instanceId: string) {
  const host = sceneChar(cardId, uid);
  host.setCards = [{ cardId: setCardId, faceUp: false, instanceId }];
  return host;
}

function b07055State(card: CardDef, owner: Player, redMagic = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: redMagic ? RED_MAGIC_CASE.id : PLAIN_CASE.id, colors: ['白'],
  };
  state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(6);
  state.players[owner].hand = [card.id];
  state.players[owner].scene = [
    setHost(HOST_A.id, 'host-a', SET_A.id, 'set-a'),
    setHost(HOST_B.id, 'host-b', SET_B.id, 'set-b'),
  ];
  state.players[other(owner)].scene = [
    sceneChar(AP8000.id, 'ap8000'), sceneChar(AP6000.id, 'ap6000'), sceneChar(AP8001.id, 'ap8001'),
    setHost(HOST_A.id, 'opp-host', OPP_SET.id, 'opp-set'),
  ];
  return state;
}

describe('official QA Wave169: B07055/P independent optional clauses', () => {
  it.each(B07055_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner skips AP8000, then removes one set from each host and AP6000',
    ({ card, owner }) => {
      install(b07055State(card, owner), owner, `${card.id}-${owner}-skip-first`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), null);
      resolveOptional(card.id, true);
      const setPick = pendingPick(card.id, 'a1', 'charRemoveSetCard');
      expect(setPick.candidates.every(candidate => candidate.hostUid !== 'opp-host')).toBe(true);
      const selected = ['host-a', 'host-b'].map(hostUid => setPick.candidates.find(candidate => candidate.hostUid === hostUid)!);
      choose(setPick, selected[0]!.uid, selected.map(candidate => candidate.uid));
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'ap6000');

      expect(current().players[other(owner)].scene.some(character => character.uid === 'ap8000')).toBe(true);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'ap6000')).toBe(false);
      expect(current().players[owner].scene.every(character => character.setCards.length === 0)).toBe(true);
      expect(current().players[other(owner)].scene.find(character => character.uid === 'opp-host')?.setCards).toHaveLength(1);
    },
  );

  it.each(B07055_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner removes AP8000 but may decline the later set-card clause',
    ({ card, owner }) => {
      install(b07055State(card, owner), owner, `${card.id}-${owner}-remove-decline`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      choose(pendingPick(card.id, 'a1', 'sceneRemove'), 'ap8000');
      resolveOptional(card.id, false);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'ap8000')).toBe(false);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'ap6000')).toBe(true);
      expect(current().players[owner].scene.every(character => character.setCards.length === 1)).toBe(true);
    },
  );
});

describe('official QA Wave169: B07055/P Red Magic is an effect gate, not a use gate', () => {
  it.each(B07055_PRINTS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner remains usable without Red Magic but has no effect',
    ({ card, owner }) => {
      const state = b07055State(card, owner, false);
      const beforeScene = JSON.stringify(state.players);
      install(state, owner, `${card.id}-${owner}-no-red-magic`);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      expect(current().players[owner].hand).not.toContain(card.id);
      expect(current().players[owner].remove).toContain(card.id);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      const afterWithoutZones = JSON.parse(JSON.stringify(current().players)) as GameState['players'];
      afterWithoutZones[owner].hand = [card.id];
      afterWithoutZones[owner].remove = [];
      expect(JSON.stringify(afterWithoutZones)).toBe(beforeScene);
    },
  );
});

function b07056State(card: CardDef, owner: Player, witnessState: 'active' | 'sleep' | 'stun'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 169, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = fileCards(6);
  state.players[owner].hand = [card.id];
  state.players[owner].scene = [sceneChar(KOIZUMI.id, 'witness', { state: witnessState })];
  state.players[other(owner)].scene = [sceneChar(KOIZUMI.id, 'opponent-witness', { state: 'sleep' })];
  return state;
}

describe('official QA Wave169: B07056/P requires an own sleeping Koizumi', () => {
  it.each(B07056_PRINTS.flatMap(card => (['self', 'opp'] as const).flatMap(owner => (
    (['active', 'sleep', 'stun'] as const).map(witnessState => ({ card, owner, witnessState }))
  ))))('$card.id owner=$owner witness=$witnessState', ({ card, owner, witnessState }) => {
    const state = b07056State(card, owner, witnessState);
    install(state, owner, `${card.id}-${owner}-${witnessState}`);
    const before = JSON.stringify(current());
    const result = dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id });
    if (witnessState === 'sleep') {
      expect(result).toEqual({ ok: true });
      expect(current().players[owner].remove).toContain(card.id);
      expect(current().players[owner].hand).not.toContain(card.id);
    } else {
      expect(result).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    }
  });
});
