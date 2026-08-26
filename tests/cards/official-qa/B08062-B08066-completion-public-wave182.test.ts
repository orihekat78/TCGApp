// qa: card:B08062:da1937a11dcf309e17d182661b4159ebeb8de46a5d221c3e68a64c918142b883
// qa: card:B08062:e69ffd017f470a62cf136a7143741ae183e2c7155360291f9d3c385545eb58f6
// qa: card:B08063:685833a68d06da220456d118eeeaaa41518d2442d24ee467eb174be91fd6a023
// qa: card:B08063:cf1285aacbbce7287de5d266891bcbe85580b45e3a78d95c7fd831c56a032125
// qa: card:B08064:535abf870a669beab748306a5845c92a434e0d42f163fe26b359e40023c22e05
// qa: card:B08064:9a37810132741d6d17cd460d850b2118c8d4533fe9169293426809233be436f8
// qa: card:B08065:c758369a7dddc50cdfaf7333ed60a91e5c9ad6e42a67f2f798a59018a06e92d6
// qa: card:B08066:7b874358a3b2be6f3991251836cb1b2d0253c3128a3e646b9c5e3c6436781c24
// qa: card:B08066:9862605d3cacb3306bf10b3e03c8a0d6eec9287bc3d5c4a1ef3dd64b9f344b07

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05087 } from '@/cards/ct-p05/B05087';
import { B05088 } from '@/cards/ct-p05/B05088';
import { B08062 } from '@/cards/ct-p08/B08062';
import { B08063 } from '@/cards/ct-p08/B08063';
import { B08064 } from '@/cards/ct-p08/B08064';
import { B08065 } from '@/cards/ct-p08/B08065';
import { B08066 } from '@/cards/ct-p08/B08066';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
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

const YELLOW_PARTNER = fixture('W182_YELLOW_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const SATO = fixture('W182_SATO', { names: ['佐藤美和子'], ap: 3000 });
const TAKAGI = fixture('W182_TAKAGI', { names: ['高木渉'], ap: 4000 });
const NAGANO_A = fixture('W182_NAGANO_A', { names: ['長野A'], traits: ['長野県警'], level: 3 });
const NAGANO_B = fixture('W182_NAGANO_B', { names: ['長野B'], traits: ['長野県警'], level: 4 });
const REMOVE_NAGANO = fixture('W182_REMOVE_NAGANO', { names: ['長野コスト'], traits: ['長野県警'], level: 5 });
const NON_NAGANO = fixture('W182_NON_NAGANO', { names: ['非長野'], traits: ['警察'], level: 3 });
const METRO_REVEAL = fixture('W182_METRO_REVEAL', { traits: ['警視庁'], level: 4 });
const METRO_COST = fixture('W182_METRO_COST', { traits: ['警視庁'], level: 7 });
const DISGUISE = fixture('W182_DISGUISE', {
  traits: ['探偵'],
  abilities: [{
    id: 'disguise', type: 'icon-disguise',
    description: '【変装】', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const LEVEL_SEVEN = fixture('W182_LEVEL_SEVEN', { colors: ['青'], level: 7, ap: 7000 });
const AP_EIGHT_THOUSAND = fixture('W182_AP_EIGHT_THOUSAND', { colors: ['青'], ap: 8000 });
const FILLER = fixture('W182_FILLER', { kind: 'event' });
const DRAW_CARD = fixture('W182_DRAW_CARD', { kind: 'event' });
const SPARE = fixture('W182_SPARE', { kind: 'event' });
const FIXTURES = [
  YELLOW_PARTNER, SATO, TAKAGI, NAGANO_A, NAGANO_B, REMOVE_NAGANO,
  NON_NAGANO, METRO_REVEAL, METRO_COST, DISGUISE, LEVEL_SEVEN,
  AP_EIGHT_THOUSAND, FILLER, DRAW_CARD, SPARE,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave182 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function beginHuman(human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave182-${label}`);
}

function install(state: GameState, human: Player, label: string): void {
  beginHuman(human, label);
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

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
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
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave182: B08062 MR timing and single-name PA aura', () => {
  it.each(['self', 'opp'] as const)('owner=%s removes the old MR before it can observe the new B08062 entry', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(9);
    state.players[owner].partner.cardId = YELLOW_PARTNER.id;
    state.players[owner].hand = [B08062.id];
    state.players[owner].scene = [sceneChar(B08062.id, 'old-mr')];
    state.players[opponent].scene = [sceneChar(AP_EIGHT_THOUSAND.id, 'removal-decoy')];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08062-mr-overwrite`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08062.id }))
      .toEqual({ ok: true });

    expect(current().players[owner].scene.filter(character => character.cardId === B08062.id)).toHaveLength(1);
    expect(current().players[owner].scene.some(character => character.uid === 'old-mr')).toBe(false);
    expect(current().players[owner].remove).toContain(B08062.id);
    expect(current().players[opponent].scene.some(character => character.uid === 'removal-decoy')).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it.each([
    ['self', SATO], ['self', TAKAGI], ['opp', SATO], ['opp', TAKAGI],
  ] as const)('owner=%s treats a lone $1.name character as satisfying the PA-MR aura', (owner, only) => {
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partnerAreaMR = {
      cardId: B08062.id, uid: `partnerMR:${owner}`, state: 'active',
    } as GameState['players'][Player]['partnerAreaMR'];
    state.players[owner].scene = [sceneChar(only.id, 'only')];
    install(state, owner, `${owner}-B08062-${only.id}`);

    expect(read.char.ap(current(), 'only')).toBe((only.ap ?? 0) + 1000);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    const withDecoy = structuredClone(current());
    withDecoy.players[owner].scene.push(sceneChar(NON_NAGANO.id, 'decoy'));
    expect(useGameStateStore.getState().setGameState(withDecoy)).toBe(true);
    expect(read.char.ap(current(), 'only')).toBe(only.ap);
  });
});

describe('official QA Wave182: B08063 mandatory end effect and disguise boundary', () => {
  it.each(['self', 'opp'] as const)('owner=%s must draw one and remove one hand card when the end condition resolves', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'end', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B08063.id, 'kuroda'),
      sceneChar(NAGANO_A.id, 'nagano-a'),
      sceneChar(NAGANO_B.id, 'nagano-b'),
    ];
    state.players[owner].hand = [SPARE.id];
    state.players[owner].deck = [DRAW_CARD.id, FILLER.id];
    beginHuman(owner, `${owner}-B08063-mandatory`);
    event.emit(state, 'phase:end:start', { player: owner });
    runAllUntilEmpty(state);
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().players[owner].hand).toContain(DRAW_CARD.id);
    const discard = pendingPick(B08063.id, 'a2', 'discard');
    expect(discard).toMatchObject({ player: owner, nMin: 1, nMax: 1 });
    chooseCard(discard, SPARE.id);
    expect(current().players[owner].remove).toContain(SPARE.id);
  });

  it.each(['self', 'opp'] as const)('owner=%s loses only the printed on-scene Nagano trait after a real disguise', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08063.id, 'kuroda')];
    state.players[opponent].scene = [sceneChar(LEVEL_SEVEN.id, 'target', { state: 'sleep' })];
    state.players[owner].hand = [DISGUISE.id];
    mutate.char.grantTrait(state, 'kuroda', '外部付与');
    install(state, owner, `${owner}-B08063-disguise`);
    expect(read.char.traits(current(), 'kuroda')).toEqual(expect.arrayContaining(['長野県警', '外部付与']));

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'kuroda', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: opponent, choice: { kind: 'pass' },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner,
      choice: { kind: 'disguise', cardId: DISGUISE.id },
    })).toEqual({ ok: true });

    expect(current().players[owner].scene.find(character => character.uid === 'kuroda')?.cardId).toBe(DISGUISE.id);
    expect(read.char.traits(current(), 'kuroda')).toEqual(expect.arrayContaining(['探偵', '外部付与']));
    expect(read.char.traits(current(), 'kuroda')).not.toContain('長野県警');
    expect(current().players[owner].deck.at(-1)).toBe(B08063.id);
  });
});

describe('official QA Wave182: B08064 effect reveal lifetime and owner-only cost', () => {
  it.each(['self', 'opp'] as const)('owner=%s keeps the revealed card public only until the enter effect finishes', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['黄'];
    state.players[owner].file = fileCards(7);
    state.players[owner].hand = [B08064.id, METRO_REVEAL.id];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    state.players[opponent].scene = [sceneChar(LEVEL_SEVEN.id, 'level-seven')];
    install(state, owner, `${owner}-B08064-reveal`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08064.id }))
      .toEqual({ ok: true });
    resolveOptional(B08064.id, 'a1', true);
    chooseCard(pendingPick(B08064.id, 'a1', 'handReveal'), METRO_REVEAL.id);
    const remove = pendingPick(B08064.id, 'a1', 'sceneRemove');

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, audience: 'all', cardIds: [METRO_REVEAL.id], lifetime: 'effect',
      source: { cardId: B08064.id, abilityId: 'a1' },
    });
    expect(current().players[owner].hand).toContain(METRO_REVEAL.id);
    choose(remove, null);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s rejects an opponent-only police cost and accepts the own occurrence', owner => {
    const opponent = other(owner);
    const rejected = createEmptyGameState();
    rejected.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    rejected.players[owner].scene = [sceneChar(B08064.id, 'shiratori')];
    rejected.players[opponent].scene = [sceneChar(METRO_COST.id, 'opp-cost')];
    rejected.players[owner].deck = [DRAW_CARD.id];
    install(rejected, owner, `${owner}-B08064-cost-reject`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'shiratori', abilId: 'a2',
      costParams: { sceneToDeckBottom: { uids: ['opp-cost'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);

    const accepted = createEmptyGameState();
    accepted.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    accepted.players[owner].scene = [
      sceneChar(B08064.id, 'shiratori'), sceneChar(METRO_COST.id, 'own-cost'),
    ];
    accepted.players[opponent].scene = [sceneChar(METRO_COST.id, 'opp-cost')];
    accepted.players[owner].deck = [DRAW_CARD.id];
    install(accepted, owner, `${owner}-B08064-cost-accept`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'shiratori', abilId: 'a2',
      costParams: { sceneToDeckBottom: { uids: ['own-cost'] } },
    })).toEqual({ ok: true });
    expect(current().players[owner].scene.some(character => character.uid === 'own-cost')).toBe(false);
    expect(current().players[opponent].scene.some(character => character.uid === 'opp-cost')).toBe(true);
    expect(current().players[owner].deck).toContain(METRO_COST.id);
    expect(current().players[owner].hand).toContain(DRAW_CARD.id);
  });
});

describe('official QA Wave182: B08065 automatic continuous AP', () => {
  it.each(['self', 'opp'] as const)('owner=%s gains and loses AP immediately with each continuous gate', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].file = fileCards(6);
    state.players[owner].scene = [
      sceneChar(B08065.id, 'yamato'),
      sceneChar(NAGANO_A.id, 'nagano-a'),
      sceneChar(NAGANO_B.id, 'nagano-b'),
    ];
    install(state, owner, `${owner}-B08065-continuous`);

    expect(read.char.ap(current(), 'yamato')).toBe((B08065.ap ?? 0) + 2000);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    const fileFive = structuredClone(current());
    fileFive.players[owner].file.pop();
    expect(useGameStateStore.getState().setGameState(fileFive)).toBe(true);
    expect(read.char.ap(current(), 'yamato')).toBe(B08065.ap);

    const wrongTurn = structuredClone(state);
    wrongTurn.turn.player = other(owner);
    expect(useGameStateStore.getState().setGameState(wrongTurn)).toBe(true);
    expect(read.char.ap(current(), 'yamato')).toBe(B08065.ap);

    const twoNagano = structuredClone(state);
    twoNagano.players[owner].scene = twoNagano.players[owner].scene.filter(character => character.uid !== 'nagano-b');
    expect(useGameStateStore.getState().setGameState(twoNagano)).toBe(true);
    expect(read.char.ap(current(), 'yamato')).toBe(B08065.ap);
  });
});

describe('official QA Wave182: B08066 cost ownership and remove-exit observers', () => {
  it.each(['self', 'opp'] as const)('owner=%s pays only from its own remove area', owner => {
    const opponent = other(owner);
    const rejected = createEmptyGameState();
    rejected.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    rejected.players[owner].scene = [sceneChar(B08066.id, 'yui')];
    rejected.players[owner].remove = [NON_NAGANO.id];
    rejected.players[opponent].remove = [REMOVE_NAGANO.id];
    install(rejected, owner, `${owner}-B08066-cost-reject`);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'yui', abilId: 'a1',
      costParams: { removeAreaToDeckBottom: { ids: [REMOVE_NAGANO.id] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);

    const accepted = createEmptyGameState();
    accepted.turn = { number: 182, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    accepted.players[owner].scene = [sceneChar(B08066.id, 'yui'), sceneChar(NAGANO_A.id, 'grant-target')];
    accepted.players[owner].remove = [REMOVE_NAGANO.id];
    accepted.players[opponent].remove = [REMOVE_NAGANO.id];
    accepted.players[owner].deck = [FILLER.id];
    install(accepted, owner, `${owner}-B08066-cost-accept`);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'yui', abilId: 'a1',
      costParams: { removeAreaToDeckBottom: { ids: [REMOVE_NAGANO.id] } },
    })).toEqual({ ok: true });
    chooseCard(pendingPick(B08066.id, 'a1', 'charGrantKeyword'), null);
    expect(current().players[owner].scene.find(character => character.uid === 'yui')?.state).toBe('sleep');
    expect(current().players[owner].remove).not.toContain(REMOVE_NAGANO.id);
    expect(current().players[owner].deck).toContain(REMOVE_NAGANO.id);
    expect(current().players[opponent].remove).toEqual([REMOVE_NAGANO.id]);
  });

  it('queues both shipped Morofushi and Yamato remove-exit abilities when the cost leaves remove', () => {
    const state = createEmptyGameState();
    state.turn = { number: 182, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = YELLOW_PARTNER.id;
    state.players.self.scene = [
      sceneChar(B08066.id, 'yui'),
      sceneChar(B05087.id, 'morofushi'),
      sceneChar(B05088.id, 'yamato-observer'),
    ];
    state.players.opp.scene = [sceneChar(LEVEL_SEVEN.id, 'observer-target')];
    state.players.self.remove = [REMOVE_NAGANO.id];
    state.players.self.deck = [FILLER.id];
    install(state, 'self', 'B08066-remove-exit-observers');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'yui', abilId: 'a1',
      costParams: { removeAreaToDeckBottom: { ids: [REMOVE_NAGANO.id] } },
    })).toEqual({ ok: true });

    const group = pendingOwnerOrderGroup(current(), 'self');
    expect(group.filter(entry => [B05087.id, B05088.id].includes(entry.source.cardId))
      .map(entry => entry.source.cardId).sort()).toEqual([B05087.id, B05088.id].sort());
    expect(current().players.self.remove).not.toContain(REMOVE_NAGANO.id);
    expect(current().players.self.deck).toContain(REMOVE_NAGANO.id);
    expect(current().players.self.scene.find(character => character.uid === 'yui')?.state).toBe('sleep');
    expect(Object.values(current().players.self.scene.find(
      character => character.uid === 'morofushi',
    )?.declaredUseCount ?? {})).toContain(1);
    expect(Object.values(current().players.self.scene.find(
      character => character.uid === 'yamato-observer',
    )?.declaredUseCount ?? {})).toContain(1);
  });
});
