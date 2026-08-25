// qa: card:B06076:2bcbc572704a40c4bd313efcdb48dc88426ff84922e2c41ac0fcde537aec79ab
// qa: card:B06077:65dd2c7e49e2adf37709417f08fbadb4f39726eb883e81d8d5c811220ad32722
// qa: card:B06085:d1c94c78592eadb05a3dffd93557a2e630046e03a30c05d4326e2b09a1664141
// qa: card:B06085:1b0a91fc4f7f6848d183ec4bdbb062fb4d26144fe32b0459fe99f07ec54fcc64
// qa: card:B06085:8b2afa65e94bc9030fd142d29d8351670cafb8e77bb5f4dbd3ddf286dc486e3b
// qa: card:B06086:7e995814959f1317d5d3a0209d1a4fe2bdd07f8bce570f7d1491700501592010
// qa: card:B06086:c84d7aad4528fd6d980afa11b31629dd80c57a9c461526f6b41e76abb0604128
// qa: card:B06086:c609f7a1a0c521302172c1f974c7bd0f428812c87dbbe14e019da0d62c3a0c72

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06077 } from '@/cards/ct-p06/B06077';
import { B06077P } from '@/cards/ct-p06/B06077P';
import { B06085 } from '@/cards/ct-p06/B06085';
import { B06085P } from '@/cards/ct-p06/B06085P';
import { B06086 } from '@/cards/ct-p06/B06086';
import { B06086P } from '@/cards/ct-p06/B06086P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HAND_A = fixture('W161_HAND_A', { kind: 'event' });
const HAND_B = fixture('W161_HAND_B', { kind: 'event' });
const HAND_C = fixture('W161_HAND_C', { kind: 'event' });
const HAND_D = fixture('W161_HAND_D', { kind: 'event' });
const FBI_ENTRY = fixture('W161_FBI_ENTRY', { level: 6, traits: ['FBI'] });
const ACTION_TARGET = fixture('W161_ACTION_TARGET', { ap: 1000 });
const NON_MR = fixture('W161_NON_MR', { ap: 8000 });
const MR = fixture('W161_MR', { ap: 8000, rarity: 'MR' });
const YELLOW_PARTNER = fixture('W161_YELLOW_PARTNER', {
  kind: 'partner', colors: ['黄'], level: undefined, ap: undefined, lp: 1,
});
const EV_A = fixture('W161_EV_A', { kind: 'event' });
const EV_B = fixture('W161_EV_B', { kind: 'event' });
const EV_C = fixture('W161_EV_C', { kind: 'event' });
const EV_D = fixture('W161_EV_D', { kind: 'event' });
const EV_E = fixture('W161_EV_E', { kind: 'event' });
const EV_F = fixture('W161_EV_F', { kind: 'event' });
const DECK_BONUS = fixture('W161_DECK_BONUS', { kind: 'event' });
const DECK_TAIL = fixture('W161_DECK_TAIL', { kind: 'event' });
const FILE_CARD = fixture('W161_FILE_CARD', { kind: 'event' });
const FIXTURES = [
  HAND_A, HAND_B, HAND_C, HAND_D, FBI_ENTRY, ACTION_TARGET, NON_MR, MR,
  YELLOW_PARTNER, EV_A, EV_B, EV_C, EV_D, EV_E, EV_F, DECK_BONUS, DECK_TAIL, FILE_CARD,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave161 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave161-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(verb: string, cardId?: string, abilityId?: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    atomVerb: verb,
    ...(cardId ? { source: { cardId, ...(abilityId ? { abilityId } : {}) } } : {}),
  });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 24 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) break;
    if (action.phase === 'guard-window') {
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    } else if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const alreadyActed = action.phase === 'action-1'
        ? action.firstActed
        : action.phase === 'action-2'
          ? action.secondActed
          : action.firstRedoActed;
      if (alreadyActed === undefined) {
        const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
        const player = current().players.self.scene.some(card => card.uid === actingUid) ? 'self' : 'opp';
        expect(dispatchEngineAction({
          type: 'actionContact', actionId, player, choice: { kind: 'pass' },
        })).toEqual({ ok: true });
      }
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction(action.judgeResolved === true
        ? { type: 'actionAdvance', actionId }
        : { type: 'actionJudge', actionId })).toEqual({ ok: true });
    } else {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function b06085Board(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 161, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner.cardId = YELLOW_PARTNER.id;
  state.players[owner].scene = [sceneChar(card.id, 'matsuda')];
  state.players[other(owner)].deck = [DECK_BONUS.id, DECK_TAIL.id];
  return state;
}

function declareB06085(card: CardDef): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: 'matsuda', abilId: 'a1',
    abilityOrigin: 'printed', abilityIndex: 0,
  })).toEqual({ ok: true });
  expect(current().players.self.scene.concat(current().players.opp.scene)
    .find(character => character.uid === 'matsuda')?.state).toBe('sleep');
  expect(card.abilities[0]?.id).toBe('a1');
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave161: B06076 declared ability', () => {
  it.each(['self', 'opp'] as const)(
    'owner=%s uses it during the incident chapter when the opponent has four cards',
    owner => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 161, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.status = '事件編';
      state.players[owner].scene = [sceneChar('B06076', 'james')];
      state.players[opponent].hand = [HAND_A.id, HAND_B.id, HAND_C.id, HAND_D.id];
      install(state, owner, `B06076-${owner}-incident-declared`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'james', abilId: 'a3',
        abilityOrigin: 'printed', abilityIndex: 2,
      })).toEqual({ ok: true });

      expect(current().players[owner].scene[0]).toMatchObject({ uid: 'james', state: 'sleep' });
      expect(current().players[opponent].hand).toHaveLength(3);
      expect(current().players[opponent].remove).toHaveLength(1);
    },
  );

  it('rejects three opposing cards atomically', () => {
    const state = createEmptyGameState();
    state.turn = { number: 161, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.status = '事件編';
    state.players.self.scene = [sceneChar('B06076', 'james')];
    state.players.opp.hand = [HAND_A.id, HAND_B.id, HAND_C.id];
    install(state, 'self', 'B06076-below-threshold');
    const before = current();

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'james', abilId: 'a3',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.self.scene[0]?.state).toBe('active');
    expect(current().players.opp.hand).toHaveLength(3);
  });
});

describe('official QA Wave161: B06077 action-end survives the opposing character leaving', () => {
  it.each([B06077, B06077P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner fires while its source remains on scene',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 161, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].file = Array.from({ length: 6 }, () => ({
        type: 'card-back' as const, cardId: FILE_CARD.id,
      }));
      state.players[owner].scene = [sceneChar(card.id, 'jodie')];
      state.players[owner].hand = [FBI_ENTRY.id];
      state.players[opponent].scene = [sceneChar(ACTION_TARGET.id, 'action-target', { state: 'sleep' })];
      install(state, owner, `${card.id}-${owner}-target-leaves`);

      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'jodie', targetUid: 'action-target' }))
        .toEqual({ ok: true });
      finishCharacterAction(useGameStateStore.getState().activeActionId!);
      expect(current().players[opponent].remove).toContain(ACTION_TARGET.id);
      expect(current().players[owner].scene.some(character => character.uid === 'jodie')).toBe(true);

      surfacePendingSideChannels();
      const optional = useGameStateStore.getState().pendingEffectOptional;
      expect(optional, 'B06077/B06077P action-end trigger remains card-bound after target leaves').toMatchObject({
        player: owner, source: { cardId: card.id, uid: 'jodie', abilityId: 'a2' },
      });
      expect(dispatchEngineAction(bindPendingDecision(optional!, {
        type: 'optionalResolve', run: true,
      }))).toEqual({ ok: true });
      const entry = pendingPick('sceneEnter', card.id, 'a2');
      expect(entry.candidates.map(candidate => candidate.cardId)).toEqual([FBI_ENTRY.id]);
      choose(entry, entry.candidates[0]!.uid);

      expect(current().players[owner].remove).toContain(card.id);
      expect(current().players[owner].scene.find(character => character.cardId === FBI_ENTRY.id))
        .toMatchObject({ state: 'active', isNamed: true });
    },
  );
});

describe('official QA Wave161: B06085 public declared flow', () => {
  it.each([B06085, B06085P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner selects middle evidence and places the gained character on top',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = b06085Board(card, owner);
      state.players[opponent].evidence = [evidence(EV_A.id), evidence(EV_B.id), evidence(EV_C.id)];
      state.players[opponent].scene = [sceneChar(NON_MR.id, 'non-mr')];
      install(state, owner, `${card.id}-${owner}-middle-evidence`);

      declareB06085(card);
      const evidencePick = pendingPick('evidenceToDeckBottom', card.id, 'a1');
      const middle = evidencePick.candidates.find(candidate => candidate.index === 1);
      expect(middle, 'B06085/B06085P arbitrary evidence position').toMatchObject({ cardId: EV_B.id, player: opponent, area: 'evidence', index: 1 });
      choose(evidencePick, middle!.uid);

      const characterPick = pendingPick('sceneToEvidence', card.id, 'a1');
      expect(characterPick.candidates.map(candidate => candidate.uid)).toEqual(['non-mr']);
      choose(characterPick, 'non-mr');

      expect(current().players[opponent].deck.at(-1)).toBe(EV_B.id);
      expect(current().players[opponent].evidence.map(item => item.cardId))
        .toEqual([EV_A.id, EV_C.id, NON_MR.id]);
      expect(current().players[opponent].evidence.at(-1)).toMatchObject({
        cardId: NON_MR.id, faceUp: true,
      });
    },
  );

  it.each([B06085, B06085P])(
    '$id sends a selected opposing MR through evidence into the partner area',
    card => {
      const state = b06085Board(card, 'self');
      state.players.opp.evidence = [evidence(EV_A.id)];
      state.players.opp.scene = [sceneChar(MR.id, 'mr')];
      install(state, 'self', `${card.id}-mr-redirect`);

      declareB06085(card);
      choose(pendingPick('evidenceToDeckBottom', card.id, 'a1'), null);
      const characterPick = pendingPick('sceneToEvidence', card.id, 'a1');
      choose(characterPick, 'mr');

      expect(current().players.opp.scene.some(character => character.uid === 'mr')).toBe(false);
      expect(current().players.opp.partnerAreaMR, 'B06085/B06085P MR redirect').toMatchObject({ cardId: MR.id });
      expect(current().players.opp.evidence.map(item => item.cardId)).toEqual([EV_A.id, DECK_BONUS.id]);
      expect(current().players.opp.evidence.at(-1)).toMatchObject({ cardId: DECK_BONUS.id, faceUp: true });
      expect(current().players.opp.deck).toEqual([DECK_TAIL.id]);
    },
  );

  it.each([
    { card: B06085, mode: 'character-only' as const },
    { card: B06085P, mode: 'evidence-only' as const },
  ])('$card.id permits the independent $mode choice', ({ card, mode }) => {
    const state = b06085Board(card, 'self');
    state.players.opp.evidence = [evidence(EV_A.id)];
    state.players.opp.scene = [sceneChar(NON_MR.id, 'non-mr')];
    install(state, 'self', `${card.id}-${mode}`);

    declareB06085(card);
    const evidencePick = pendingPick('evidenceToDeckBottom', card.id, 'a1');
    choose(evidencePick, mode === 'character-only' ? null : evidencePick.candidates[0]!.uid);
    const characterPick = pendingPick('sceneToEvidence', card.id, 'a1');
    choose(characterPick, mode === 'character-only' ? 'non-mr' : null);

    if (mode === 'character-only') {
      expect(current().players.opp.evidence.map(item => item.cardId), 'B06085 independent character-only choice').toEqual([EV_A.id, NON_MR.id]);
      expect(current().players.opp.scene.some(character => character.uid === 'non-mr')).toBe(false);
      expect(current().players.opp.deck).toEqual([DECK_BONUS.id, DECK_TAIL.id]);
    } else {
      expect(current().players.opp.evidence, 'B06085P independent evidence-only choice').toEqual([]);
      expect(current().players.opp.scene.some(character => character.uid === 'non-mr')).toBe(true);
      expect(current().players.opp.deck.at(-1)).toBe(EV_A.id);
    }
  });
});

describe('official QA Wave161: B06086 resolves before guard with arbitrary evidence positions', () => {
  it.each([B06086, B06086P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner flips selected middle/last evidence before guard and gains AP',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 161, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(card.id, 'hagi')];
      state.players[owner].evidence = [evidence(EV_A.id), evidence(EV_B.id), evidence(EV_C.id)];
      state.players[opponent].evidence = [evidence(EV_D.id), evidence(EV_E.id), evidence(EV_F.id)];
      install(state, owner, `${card.id}-${owner}-pre-guard`);

      expect(dispatchEngineAction({
        type: 'actionDeclareCase', byUid: 'hagi', targetPlayer: opponent,
      })).toEqual({ ok: true });
      const actionId = useGameStateStore.getState().activeActionId!;

      const ownFlip = pendingPick('evidenceFlip', card.id, 'a1');
      const ownMiddle = ownFlip.candidates.find(candidate => candidate.index === 1);
      expect(ownMiddle).toMatchObject({ cardId: EV_B.id, player: owner, area: 'evidence', index: 1 });
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      choose(ownFlip, ownMiddle!.uid);

      const opposingFlip = pendingPick('evidenceFlip', card.id, 'a1');
      const opposingLast = opposingFlip.candidates.find(candidate => candidate.index === 2);
      expect(opposingLast).toMatchObject({ cardId: EV_F.id, player: opponent, area: 'evidence', index: 2 });
      choose(opposingFlip, opposingLast!.uid);

      expect(current().players[owner].evidence.map(item => item.faceUp)).toEqual([false, true, false]);
      expect(current().players[opponent].evidence.map(item => item.faceUp)).toEqual([false, false, true]);
      expect(read.char.ap(current(), 'hagi')).toBe(7000);
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    },
  );

  it.each([
    { card: B06086, available: 'self-only' as const },
    { card: B06086P, available: 'opp-only' as const },
  ])('$card.id makes the sole $available evidence flip mandatory without an AP bonus', ({ card, available }) => {
    const state = createEmptyGameState();
    state.turn = { number: 161, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(card.id, 'hagi')];
    if (available === 'self-only') {
      state.players.self.evidence = [evidence(EV_A.id), evidence(EV_B.id)];
      state.players.opp.scene = [sceneChar(ACTION_TARGET.id, 'action-target', { state: 'sleep' })];
    } else {
      state.players.opp.evidence = [evidence(EV_D.id), evidence(EV_E.id)];
    }
    install(state, 'self', `${card.id}-${available}`);

    const declared = available === 'self-only'
      ? dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'hagi', targetUid: 'action-target' })
      : dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'hagi', targetPlayer: 'opp' });
    expect(declared).toEqual({ ok: true });

    const flip = pendingPick('evidenceFlip', card.id, 'a1');
    expect(flip.player).toBe('self');
    const selected = flip.candidates.find(candidate => candidate.index === 1);
    const before = JSON.stringify(current());
    expect(dispatchEngineAction(bindPendingDecision(flip, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    choose(useGameStateStore.getState().pendingEffectPick!, selected!.uid);

    const evidenceOwner = available === 'self-only' ? 'self' : 'opp';
    expect(current().players[evidenceOwner].evidence.map(item => item.faceUp)).toEqual([false, true]);
    expect(read.char.ap(current(), 'hagi')).toBe(6000);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
