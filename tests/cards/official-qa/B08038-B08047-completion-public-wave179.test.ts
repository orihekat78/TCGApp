// qa: card:B08038:e47123f9e1245d63129ed54c2b95a76198d5f97abc9116047b1b635275aad06a
// qa: card:B08038:f8f46017d87b910c05faf7a9553e12f283c51a7e645bf43caf5146dc8dd3fde8
// qa: card:B08038:fd298447ad15716de7a161bbcce756016aeb5cffc6829bcf2e58b91fdb4ad5a0
// qa: card:B08043:d2daf65f8f37c6b92a14e58a624e94f31d9bc62c20d0e0f1cf253457f9149203
// qa: card:B08046:7dd4d4afb1549412d31916afecd76ee07e4991bf7b74dc7fb196896cad7fb01a
// qa: card:B08047:6c1e3617937ea14c15441600fcb9ffb67421393476b22c504842e1cdc8e6029f

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06042 } from '@/cards/ct-p06/B06042';
import { B08038 } from '@/cards/ct-p08/B08038';
import { B08043 } from '@/cards/ct-p08/B08043';
import { B08046 } from '@/cards/ct-p08/B08046';
import { B08047 } from '@/cards/ct-p08/B08047';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
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
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const RED_PARTNER = fixture('W179_RED_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const CONTACT_TARGET = fixture('W179_CONTACT_TARGET', { ap: 1000, colors: ['青'] });
const HIGH_SCHOOL = fixture('W179_HIGH_SCHOOL', { traits: ['高校生'] });
const SUZUKI = fixture('W179_SUZUKI', { traits: ['鈴木財閥'] });
const FBI_ALLY = fixture('W179_FBI_ALLY', { traits: ['FBI'], level: 3 });
const LEVEL_NINE = fixture('W179_LEVEL_NINE', { level: 9 });
const LEVEL_TEN = fixture('W179_LEVEL_TEN', { level: 10 });
const NEGATIVE_LP = fixture('W179_NEGATIVE_LP', { lp: 1 });
const HAND_A = fixture('W179_HAND_A', { kind: 'event', ap: undefined, lp: undefined });
const HAND_B = fixture('W179_HAND_B', { kind: 'event', ap: undefined, lp: undefined });
const FILLER = fixture('W179_FILLER', { kind: 'event', ap: undefined, lp: undefined });
const FIXTURES = [
  RED_PARTNER, CONTACT_TARGET, HIGH_SCHOOL, SUZUKI, FBI_ALLY, LEVEL_NINE, LEVEL_TEN,
  NEGATIVE_LP, HAND_A, HAND_B, FILLER,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave179 game state');
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
  resetPresentationQueue(`qa-wave179-${label}`);
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

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function normalContactState(owner: Player, deck: string[], remove: string[] = []): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(B08038.id, 'actor')];
  state.players[other(owner)].scene = [sceneChar(CONTACT_TARGET.id, 'target', { state: 'sleep' })];
  state.players[owner].deck = [...deck];
  state.players[owner].remove = [...remove];
  state.players[other(owner)].deck = [FILLER.id, FILLER.id, FILLER.id];
  return state;
}

function reachB08038Optional(owner: Player): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 6; step += 1) {
    surfacePendingSideChannels();
    if (useGameStateStore.getState().pendingEffectOptional) return actionId;
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error(`B08038 optional did not surface for ${owner}`);
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

describe('official QA Wave179: B08038 exact mill and effect-contact behavior', () => {
  it.each(['self', 'opp'] as const)('owner=%s deck1 cannot execute top two or its AP tail', owner => {
    install(normalContactState(owner, [HIGH_SCHOOL.id], [SUZUKI.id]), owner, `${owner}-B08038-deck-one`);
    reachB08038Optional(owner);
    const before = {
      deck: [...current().players[owner].deck],
      remove: [...current().players[owner].remove],
      ap: read.char.ap(current(), 'actor'),
    };

    resolveOptional(B08038.id, 'a1', true);

    expect(current().players[owner].deck, 'B08038 exact top-two gate leaves deck1 untouched').toEqual(before.deck);
    expect(current().players[owner].remove, 'B08038 historical matching remove cards cannot satisfy the skipped tail')
      .toEqual(before.remove);
    expect(read.char.ap(current(), 'actor'), 'B08038 deck shortage grants no AP').toBe(before.ap);
  });

  it.each(['self', 'opp'] as const)('owner=%s gains +1000 once when both removed cards qualify', owner => {
    install(
      normalContactState(owner, [HIGH_SCHOOL.id, SUZUKI.id, FILLER.id]),
      owner,
      `${owner}-B08038-two-matches`,
    );
    reachB08038Optional(owner);

    resolveOptional(B08038.id, 'a1', true);

    expect(current().players[owner].remove, 'B08038 removes both qualifying deck-top cards')
      .toEqual([HIGH_SCHOOL.id, SUZUKI.id]);
    expect(read.char.ap(current(), 'actor'), 'B08038 condition is boolean, not +1000 per match')
      .toBe((B08038.ap ?? 0) + 1000);
  });

  it.each(['self', 'opp'] as const)('owner=%s also triggers from a real effect-generated contact', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = [...B06042.colors];
    state.players[owner].file = fileCards(B06042.level ?? 0);
    state.players[owner].hand = [B06042.id];
    state.players[owner].scene = [sceneChar(B08038.id, 'actor')];
    state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'target')];
    state.players[owner].deck = [HIGH_SCHOOL.id, SUZUKI.id, FILLER.id];
    state.players[opponent].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08038-effect-contact`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06042.id }))
      .toEqual({ ok: true });
    choose(pendingPick(B06042.id, 'a1', 'charModifyAP'), 'actor');
    const apBeforeContact = read.char.ap(current(), 'actor');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'actor', abilId: 'b06042_granted_contact',
    })).toEqual({ ok: true });
    choose(pendingPick(B08038.id, 'b06042_granted_contact', 'bindPick'), 'target');
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectOptional,
      'B08038 contact:start trigger is shared by action and effect contact').toMatchObject({
      source: { cardId: B08038.id, abilityId: 'a1', uid: 'actor' },
    });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(flow.action._getContext(current(), actionId)).toMatchObject({
      byUid: 'actor', generatedByEffect: true,
    });
    resolveOptional(B08038.id, 'a1', true);
    expect(read.char.ap(current(), 'actor'), 'B08038 effect-contact trigger adds its own single +1000')
      .toBe(apBeforeContact + 1000);
  });
});

describe('official QA Wave179: B08043 has no comparison target without an own scene', () => {
  it.each(['self', 'opp'] as const)('owner=%s cannot remove even a negative-LP opponent when own scene is empty', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['白'];
    state.players[owner].file = fileCards(B08043.level ?? 0);
    state.players[owner].hand = [B08043.id];
    state.players[owner].deck = [FILLER.id, FILLER.id];
    state.players[opponent].scene = [sceneChar(NEGATIVE_LP.id, 'negative-target', { lpOverride: -1 })];
    state.players[opponent].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08043-empty-own-scene`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08043.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick,
      'B08043 empty own scene yields no valid LP comparison candidates').toBeNull();
    expect(current().players[opponent].scene.map(character => character.uid)).toEqual(['negative-target']);
    expect(current().players[owner].remove, 'B08043 event still finishes normally').toContain(B08043.id);
  });
});

describe('official QA Wave179: B08046 FBI count includes its source', () => {
  it.each(['self', 'opp'] as const)('owner=%s needs only one additional own FBI character', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].scene = [sceneChar(B08046.id, 'source'), sceneChar(FBI_ALLY.id, 'fbi-ally')];
    state.players[opponent].scene = [
      sceneChar(LEVEL_NINE.id, 'level-nine'), sceneChar(LEVEL_TEN.id, 'level-ten'),
    ];
    install(state, owner, `${owner}-B08046-source-counts`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    }), 'B08046 source plus one ally satisfies FBI count two').toEqual({ ok: true });
    const pick = pendingPick(B08046.id, 'a1', 'sceneRemove');
    expect(pick.candidates.map(candidate => candidate.uid), 'B08046 keeps the level10 decoy out')
      .toContain('level-nine');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('level-ten');
    choose(pick, 'level-nine');
    expect(current().players[opponent].remove).toContain(LEVEL_NINE.id);
  });

  it.each(['self', 'opp'] as const)('owner=%s source alone is only one own FBI', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].scene = [sceneChar(B08046.id, 'source')];
    state.players[opponent].scene = [sceneChar(FBI_ALLY.id, 'opponent-fbi')];
    install(state, owner, `${owner}-B08046-source-only`);
    const before = JSON.stringify(current());

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    }), 'B08046 cannot count an opponent FBI as its second own character')
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });
});

describe('official QA Wave179: B08047 zero-card hand cost still pays sleep', () => {
  it.each((['self', 'opp'] as const).flatMap(owner => ([0, 1, 2] as const).map(handCount => ({ owner, handCount }))))(
    'owner=$owner hand=$handCount declares with zero hand removal and sleeps',
    ({ owner, handCount }) => {
      const opponent = other(owner);
      const hand = [HAND_A.id, HAND_B.id].slice(0, handCount);
      const state = createEmptyGameState();
      state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].scene = [sceneChar(B08047.id, 'source')];
      state.players[owner].hand = [...hand];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'target')];
      install(state, owner, `${owner}-B08047-hand-${handCount}`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      })).toEqual({ ok: true });
      choose(pendingPick(B08047.id, 'a2', 'sceneRemove'), null);

      expect(current().players[owner].hand, 'B08047 hand at or below two pays zero removals').toEqual(hand);
      expect(current().players[owner].remove, 'B08047 zero-card hand cost removes nothing').toEqual([]);
      expect(current().players[owner].scene.find(character => character.uid === 'source')?.state,
        'B08047 sleep remains a required paid cost').toBe('sleep');
    },
  );

  it.each(['self', 'opp'] as const)('owner=%s cannot reuse an already sleeping source', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 179, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].scene = [sceneChar(B08047.id, 'source', { state: 'sleep' })];
    install(state, owner, `${owner}-B08047-sleep-required`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
    }), 'B08047 still requires the sleep cost even when hand removal count is zero')
      .toEqual({ ok: false, reason: 'not-allowed' });
  });
});
