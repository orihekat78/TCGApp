// qa: card:B08032:80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52
// qa: card:B08033:06ce9fd17111893f363795f972f77b8e344d6bdfdd6a919cf1c87d9c0d4fcc08
// qa: card:B08033:0ff04fc4b7cc8e0c3d7ce3cd257172df1e8dbe36b45189605cb03e3062fe0b8d
// qa: card:B08033:4785304193e3d6050fab9e20bbeb9ff17ea702ee22abfe3cfd5cce4db0ff3238
// qa: card:B08034:5169c84a9f5e909941ac80b0688e5f24c9ddca6ce6c11bc6bd2b7c3634badd02
// qa: card:B08034:a00a4fcb627dc02701efb6fdc742f723f5d1af776484e45166ccc74175e2b82f
// qa: card:B08034:d889f1124f88bd5349a26b958a18b82b1763750edd4fba8e540934e467d2c49a
// qa: card:B08036:d52596199be14d625d7776309eeaca145097a31eecca550237262ad7075cb2f4
// qa: card:B08037:0bcbb181ef2cf2a48d13e2a78537e164803e7f0ef97a2a8ca772d8ce2b5aae8c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08032 } from '@/cards/ct-p08/B08032';
import { B08033 } from '@/cards/ct-p08/B08033';
import { B08034 } from '@/cards/ct-p08/B08034';
import { B08036 } from '@/cards/ct-p08/B08036';
import { B08037 } from '@/cards/ct-p08/B08037';
import { B08038 } from '@/cards/ct-p08/B08038';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SetCardEntry } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
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

const WHITE_PARTNER = fixture('W178_WHITE_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const WHITE_HOST = fixture('W178_WHITE_HOST');
const REASONER = fixture('W178_REASONER', { lp: 1 });
const ACTIVE_TARGET = fixture('W178_ACTIVE_TARGET', { colors: ['赤'], ap: 3000 });
const SET_A = fixture('W178_SET_A', { kind: 'event', ap: undefined, lp: undefined });
const SET_B = fixture('W178_SET_B', { kind: 'event', ap: undefined, lp: undefined });
const DRAW_A = fixture('W178_DRAW_A', { kind: 'event', ap: undefined, lp: undefined });
const DRAW_B = fixture('W178_DRAW_B', { kind: 'event', ap: undefined, lp: undefined });
const FILLER = fixture('W178_FILLER', { kind: 'event', ap: undefined, lp: undefined });
const FIXTURES = [WHITE_PARTNER, WHITE_HOST, REASONER, ACTIVE_TARGET, SET_A, SET_B, DRAW_A, DRAW_B, FILLER];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave178 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function hidden(cardId: string, instanceId: string): SetCardEntry {
  return { cardId, faceUp: false, instanceId };
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave178-${label}`);
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

describe('official QA Wave178: B08032 may select its own combined-name occurrence', () => {
  it.each(['self', 'opp'] as const)('owner=%s includes the declaring B08032 itself', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08032.id, 'source'), sceneChar(B08038.id, 'ally')];
    state.players[other(owner)].scene = [sceneChar(B08038.id, 'opponent-kyogoku')];
    install(state, owner, `${owner}-B08032-self-selection`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    const pick = pendingPick(B08032.id, 'a2', 'charModifyAP');
    expect(pick.candidates.map(candidate => candidate.uid), 'B08032 own combined name matches 京極真')
      .toEqual(['source', 'ally']);
    choose(pick, 'source');

    expect(read.char.ap(current(), 'source'), 'B08032 may buff itself').toBe((B08032.ap ?? 0) + 1000);
    expect(read.char.ap(current(), 'opponent-kyogoku')).toBe(B08038.ap);
  });
});

describe('official QA Wave178: B08033 entry count, refresh continuation, and owner cost', () => {
  it.each(['self', 'opp'] as const)('owner=%s counts itself and continues setting after refresh', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['白'];
    state.players[owner].file = fileCards(B08033.level ?? 0);
    state.players[owner].hand = [B08033.id];
    state.players[owner].scene = [sceneChar(WHITE_HOST.id, 'existing')];
    state.players[owner].deck = [SET_A.id];
    state.players[owner].remove = [SET_B.id, FILLER.id];
    state.players[opponent].deck = [FILLER.id, DRAW_A.id, DRAW_B.id];
    install(state, owner, `${owner}-B08033-short-deck`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08033.id }))
      .toEqual({ ok: true });
    const entered = current().players[owner].scene.find(character => character.cardId === B08033.id)!;

    expect(entered.setCards, 'B08033 counts the entering source as the second own scene character')
      .toHaveLength(2);
    expect(entered.setCards[0]?.cardId, 'B08033 sets the only pre-refresh deck card first').toBe(SET_A.id);
    expect(current().refreshCount[owner], 'B08033 refreshes after the short deck reaches zero').toBe(1);
    expect(current().players[owner].deck, 'B08033 continues with one post-refresh set and leaves one card')
      .toHaveLength(1);
    expect(current().players[opponent].evidence, 'B08033 owner refresh gives the opponent one evidence')
      .toHaveLength(1);
  });

  it.each(['self', 'opp'] as const)('owner=%s rejects opponent set cards and pays exact own occurrences', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].scene = [
      sceneChar(B08033.id, 'source'),
      sceneChar(WHITE_HOST.id, 'owner-host-a', { setCards: [hidden(SET_A.id, 'set:owner:a')] }),
      sceneChar(WHITE_HOST.id, 'owner-host-b', { setCards: [hidden(SET_B.id, 'set:owner:b')] }),
    ];
    state.players[opponent].scene = [sceneChar(WHITE_HOST.id, 'opponent-host', {
      setCards: [hidden(SET_A.id, 'set:opp:a'), hidden(SET_B.id, 'set:opp:b')],
    })];
    install(state, owner, `${owner}-B08033-owner-cost`);
    const before = JSON.stringify(current());

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: {
        removeSetCard: {
          hostUids: ['opponent-host', 'opponent-host'], instanceIds: ['set:opp:a', 'set:opp:b'],
        },
      },
    }), 'B08033 cannot pay with opponent set cards').toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: {
        removeSetCard: {
          hostUids: ['owner-host-a', 'owner-host-b'], instanceIds: ['set:owner:a', 'set:owner:b'],
        },
      },
    })).toEqual({ ok: true });
    choose(pendingPick(B08033.id, 'a2', 'charModifyAP'), null);

    expect(current().players[owner].scene.find(character => character.uid === 'owner-host-a')?.setCards,
      'B08033 may pay one exact occurrence from the first own host').toEqual([]);
    expect(current().players[owner].scene.find(character => character.uid === 'owner-host-b')?.setCards,
      'B08033 may split the exact-two cost across a second own host').toEqual([]);
    expect(current().players[opponent].scene.find(character => character.uid === 'opponent-host')?.setCards,
      'B08033 leaves opponent occurrences untouched').toHaveLength(2);
  });
});

describe('official QA Wave178: B08034 self-target and pre-evidence reasoning timing', () => {
  it.each(['self', 'opp'] as const)('owner=%s may set the entry deck top under B08034 itself', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['白'];
    state.players[owner].partner = { cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players[owner].file = fileCards(B08034.level ?? 0);
    state.players[owner].hand = [B08034.id];
    state.players[owner].deck = [SET_A.id, FILLER.id];
    install(state, owner, `${owner}-B08034-entry-self-set`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08034.id }))
      .toEqual({ ok: true });
    const entered = current().players[owner].scene.find(character => character.cardId === B08034.id)!;
    choose(pendingPick(B08034.id, 'a1', 'sceneRemove'), null);
    const setPick = pendingPick(B08034.id, 'a1', 'charSetCard');
    expect(setPick.candidates.map(candidate => candidate.uid), 'B08034 entry effect includes its own new occurrence')
      .toContain(entered.uid);
    choose(setPick, entered.uid);

    expect(current().players[owner].scene.find(character => character.uid === entered.uid)?.setCards,
      'B08034 may host the selected deck top itself').toEqual([
      expect.objectContaining({ cardId: SET_A.id, faceUp: false }),
    ]);
  });

  it.each(['self', 'opp'] as const)('owner=%s resolves both turn-one triggers before reasoning evidence', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B08034.id, 'source-a', { setCards: [hidden(SET_A.id, 'set:a')] }),
      sceneChar(B08034.id, 'source-b', { setCards: [hidden(SET_B.id, 'set:b')] }),
      sceneChar(REASONER.id, 'reasoner'),
    ];
    state.players[owner].deck = [DRAW_A.id, DRAW_B.id, FILLER.id, FILLER.id];
    state.players[other(owner)].deck = [FILLER.id, FILLER.id];
    install(state, owner, `${owner}-B08034-simultaneous`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    const atOrderBoundary = current();
    expect(atOrderBoundary.players[owner].scene.find(character => character.uid === 'reasoner')?.state,
      'B08034 timing begins after the reasoning character sleeps').toBe('sleep');
    expect(atOrderBoundary.players[owner].evidence,
      'B08034 after-sleep reactions must finish before reasoning evidence is added').toEqual([]);
    expect(atOrderBoundary.pendingReasoningContinuation,
      'B08034 reactions hold the authenticated reasoning continuation').toBeDefined();
    const triggerGroup = current().pendingEffects.filter(entry => (
      entry.state === 'pending' && entry.source.cardId === B08034.id && entry.source.abilityId === 'a2'
    ));
    expect(triggerGroup.map(entry => entry.source.uid).sort(), 'B08034 queues both physical trigger occurrences')
      .toEqual(['source-a', 'source-b']);
    const second = triggerGroup.find(entry => entry.source.uid === 'source-b')!;
    expect(dispatchEngineAction({
      type: 'setEffectOrder', entryId: second.id, order: 0, player: owner,
    })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner).filter(entry => (
      entry.source.cardId === B08034.id && entry.source.abilityId === 'a2'
    ));
    expect(ordered.map(entry => entry.source.uid), 'B08034 owner may reverse both simultaneous triggers')
      .toEqual(['source-b', 'source-a']);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
    for (let index = 0; index < 2; index += 1) {
      const pick = pendingPick(B08034.id, 'a2', 'charRemoveSetCard');
      const sourceUid = pick.source.uid!;
      const selectedInstance = sourceUid === 'source-a' ? 'set:a' : 'set:b';
      const selected = pick.candidates.find(candidate => candidate.setCardInstanceId === selectedInstance);
      expect(selected, 'B08034 each ordered trigger keeps its own physical set occurrence selectable').toBeTruthy();
      choose(pick, selected!.uid);
    }
    surfacePendingSideChannels();

    expect(current().players[owner].scene.find(character => character.uid === 'source-a')?.setCards).toEqual([]);
    expect(current().players[owner].scene.find(character => character.uid === 'source-b')?.setCards).toEqual([]);
    expect(current().players[owner].remove, 'B08034 resolves both same-timing set removals')
      .toEqual(expect.arrayContaining([SET_A.id, SET_B.id]));
    expect(current().players[owner].hand, 'B08034 resolves both conditional draws').toEqual([DRAW_A.id, DRAW_B.id]);
    expect(current().players[owner].evidence, 'B08034 releases reasoning only after both reactions').toHaveLength(1);
    expect(current().pendingReasoningContinuation).toBeUndefined();
  });
});

describe('official QA Wave178: B08036 face-down set identity remains private', () => {
  it.each(['self', 'opp'] as const)('owner=%s cannot expose the selected hidden identity to either viewer', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08036.id, 'source')];
    state.players[owner].remove = [B08033.id];
    install(state, owner, `${owner}-B08036-hidden-identity`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    const sourcePick = pendingPick(B08036.id, 'a1', 'charSetCard');
    choose(sourcePick, sourcePick.candidates[0]!.uid);
    choose(pendingPick(B08036.id, 'a1', 'sceneToDeck'), null);

    expect(JSON.stringify(current()), 'B08036 engine authority retains the selected hidden card').toContain(B08033.id);
    for (const mode of ['solo-self', 'spectator'] as const) {
      const projection = projectReplayStateForViewer(current(), mode);
      expect(JSON.stringify(projection), `B08036 ${owner}/${mode} hides the face-down set identity`)
        .not.toContain(B08033.id);
    }
  });
});

describe('official QA Wave178: B08037 active-target permission keeps the named-state gate', () => {
  it.each((['self', 'opp'] as const).flatMap(owner => [true, false].map(isNamed => ({ owner, isNamed }))))(
    'owner=$owner named=$isNamed keeps action legality separate from target expansion',
    ({ owner, isNamed }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 178, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case = { ...state.players[owner].case, status: '解決編' };
      state.players[owner].scene = [
        sceneChar(B08037.id, 'source'),
        sceneChar(B08038.id, 'actor', { isNamed }),
      ];
      state.players[opponent].scene = [sceneChar(ACTIVE_TARGET.id, 'active-target')];
      install(state, owner, `${owner}-B08037-named-${isNamed}`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
      })).toEqual({ ok: true });
      choose(pendingPick(B08037.id, 'a1', 'charSetTurnEffect'), 'actor');
      expect(current().players[owner].scene.find(character => character.uid === 'actor')?.turnEffects.actionTargetsActive,
        'B08037 grant is installed before normal action gates').toBe(true);

      const result = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'active-target' });
      expect(result, 'B08037 target expansion never waives the named-state restriction')
        .toEqual(isNamed ? { ok: false, reason: 'not-allowed' } : { ok: true });
      expect(Boolean(useGameStateStore.getState().activeActionId)).toBe(!isNamed);
    },
  );
});
