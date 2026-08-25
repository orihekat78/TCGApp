// qa: card:B06060:2ca5b478df684d0944e74fceb7664125a59a6e2a239ae9323d3477e04506cf07
// qa: card:B06067:216635e95c72a51ec62eae36e6d454a46acedc98cc0a2a21ba43330df5ea5cdc
// qa: card:B06067:42704e74cdc71bbd20cccec5539d9b54f9235cd9a16e556a7bc2c6da0c4f8fda
// qa: card:B06071:cb8dae30a14a64f9d6492d1cca938382df2537937250eb97dca078a642423626
// qa: card:B06072:f9a68a53b3f56507b27132d0bf80e22da4efe49d79c91138658d9a6fe43eebb2
// qa: card:B06072:22be40f06dc558d4dde620e44fe198bf395c34480c4c217a4958a229a718d83e

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06060 } from '@/cards/ct-p06/B06060';
import { B06067 } from '@/cards/ct-p06/B06067';
import { B06067P } from '@/cards/ct-p06/B06067P';
import { B06071 } from '@/cards/ct-p06/B06071';
import { B06071P } from '@/cards/ct-p06/B06071P';
import { B06072 } from '@/cards/ct-p06/B06072';
import { B06072P } from '@/cards/ct-p06/B06072P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
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

const YAIBA = fixture('W160_YAIBA', { traits: ['YAIBA'], ap: 3000 });
const POLICE = fixture('W160_POLICE', { traits: ['警察'], ap: 9000 });
const NAMED_POLICE = fixture('W160_NAMED_POLICE', { traits: ['警察'], ap: 3000 });
const VICTIM = fixture('W160_VICTIM', { ap: 1000 });
const ACTIVE_TARGET = fixture('W160_ACTIVE_TARGET', { ap: 1000 });
const PROTECTED = fixture('W160_PROTECTED', {
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene',
    continuousModifier: { untargetableByOppEffect: true },
    description: '相手の能力や効果によって選ばれない。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  } satisfies AbilityDef],
});
const LOW = fixture('W160_LOW', { level: 7 });
const HIGH = fixture('W160_HIGH', { level: 8 });
const YAIBA_REMOVED = fixture('W160_YAIBA_REMOVED', { kind: 'event', traits: ['YAIBA'] });
const COST = fixture('W160_COST', { kind: 'event' });
const DRAW_A = fixture('W160_DRAW_A', { kind: 'event' });
const DRAW_B = fixture('W160_DRAW_B', { kind: 'event' });
const EVIDENCE = fixture('W160_EVIDENCE', { kind: 'event' });
const FILE_CARD = fixture('W160_FILE_CARD', { kind: 'event' });
const FIXTURES = [
  YAIBA, POLICE, NAMED_POLICE, VICTIM, ACTIVE_TARGET, PROTECTED, LOW, HIGH,
  YAIBA_REMOVED, COST, DRAW_A, DRAW_B, EVIDENCE, FILE_CARD,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId = EVIDENCE.id): EvidenceCard {
  return { cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave160 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave160-${label}`);
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

function closeCaseAction(actionId: string): void {
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 24 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const owner = current().turn.player;
    const ownerOrder = pendingOwnerOrderGroup(current(), owner);
    if (ownerOrder.length >= 2) {
      expect(ownerOrder.map(entry => entry.source.uid)).toEqual(['observer-base', 'observer-parallel']);
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder', entryIds: ownerOrder.map(entry => entry.id), player: owner,
      })).toEqual({ ok: true });
      continue;
    }
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

function activateWithB06060(owner: Player): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: 'dragon', abilId: 'a1',
    abilityOrigin: 'printed', abilityIndex: 0,
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice).toMatchObject({ player: owner, source: { cardId: B06060.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(choice!, {
    type: 'choiceResolve', choiceIndex: 0,
  }))).toEqual({ ok: true });
  const pick = pendingPick('sceneSetState', B06060.id, 'a1');
  choose(pick, 'yaiba');
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

describe('official QA Wave160: B06060 repeat reasoning and action', () => {
  it.each((['self', 'opp'] as const).flatMap(owner => (
    ['reasoning', 'action'] as const
  ).map(route => ({ owner, route }))))(
    'owner=$owner may perform $route again after B06060 reactivates YAIBA',
    ({ owner, route }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 160, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(B06060.id, 'dragon'), sceneChar(YAIBA.id, 'yaiba')];
      state.players[owner].deck = [DRAW_A.id, DRAW_B.id, DRAW_A.id];
      state.players[opponent].evidence = [evidence(), evidence()];
      install(state, owner, `${owner}-${route}-repeat`);

      if (route === 'reasoning') {
        expect(dispatchEngineAction({ type: 'reasoning', uid: 'yaiba' })).toEqual({ ok: true });
      } else {
        expect(dispatchEngineAction({
          type: 'actionDeclareCase', byUid: 'yaiba', targetPlayer: opponent,
        })).toEqual({ ok: true });
        closeCaseAction(useGameStateStore.getState().activeActionId!);
      }
      expect(current().players[owner].scene.find(card => card.uid === 'yaiba')?.state).toBe('sleep');

      activateWithB06060(owner);
      expect(current().players[owner].remove).toContain(B06060.id);
      expect(current().players[owner].scene.find(card => card.uid === 'yaiba')?.state).toBe('active');

      const repeated = route === 'reasoning'
        ? dispatchEngineAction({ type: 'reasoning', uid: 'yaiba' })
        : dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'yaiba', targetPlayer: opponent });
      expect(repeated).toEqual({ ok: true });
    },
  );
});

describe('official QA Wave160: B06067 mandatory observers and named grant', () => {
  it.each(['self', 'opp'] as const)('owner=%s resolves both physical observers mandatorily', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 160, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B06067.id, 'observer-base'),
      sceneChar(B06067P.id, 'observer-parallel'),
      sceneChar(POLICE.id, 'police'),
    ];
    state.players[opponent].scene = [sceneChar(VICTIM.id, 'victim', { state: 'sleep' })];
    state.players[owner].deck = [DRAW_A.id, DRAW_B.id, COST.id];
    install(state, owner, `${owner}-both-observers`);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'police', targetUid: 'victim' }))
      .toEqual({ ok: true });
    finishCharacterAction(useGameStateStore.getState().activeActionId!);

    expect(current().players[owner].hand, 'B06067/B06067P mandatory physical observers').toEqual([DRAW_A.id, DRAW_B.id]);
    expect(current().players[opponent].remove).toContain(VICTIM.id);
    for (const uid of ['observer-base', 'observer-parallel']) {
      expect(read.char.declaredUseCount(current(), uid, 'a2', {
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toBe(1);
    }
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each([B06067, B06067P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id grant does not bypass the owner=$owner named-state action ban',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 160, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [
        sceneChar(card.id, 'nakamori'),
        sceneChar(NAMED_POLICE.id, 'named-police', { isNamed: true }),
      ];
      state.players[opponent].scene = [sceneChar(ACTIVE_TARGET.id, 'active-target')];
      state.players[owner].hand = [COST.id];
      install(state, owner, `${card.id}-${owner}-named-ban`);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'nakamori', abilId: 'a3',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { removeFromHand: { indices: [0] } },
      })).toEqual({ ok: true });
      const pick = pendingPick('charSetTurnEffect', card.id, 'a3');
      expect(pick.candidates.map(candidate => candidate.uid)).toContain('nakamori');
      choose(pick, 'named-police');
      expect(current().players[owner].scene.find(character => character.uid === 'named-police')?.turnEffects.actionTargetsActive, 'B06067 named Police receives only the active-target grant')
        .toBe(true);

      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: 'named-police', targetUid: 'active-target',
      })).toEqual({ ok: false, reason: 'not-allowed' });
    },
  );
});

describe('official QA Wave160: B06071 non-targeting stun', () => {
  it.each([B06071, B06071P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner stuns an opposing protected sleeping character',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 160, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['白'];
      state.players[owner].file = Array.from({ length: 7 }, () => ({
        type: 'card-back' as const, cardId: FILE_CARD.id,
      }));
      state.players[owner].hand = [card.id];
      state.players[owner].scene = [sceneChar(VICTIM.id, 'own-sleep', { state: 'sleep' })];
      state.players[opponent].scene = [sceneChar(PROTECTED.id, 'protected-sleep', { state: 'sleep' })];
      install(state, owner, `${card.id}-${owner}-non-targeting`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      expect(current().players[owner].scene.find(character => character.uid === 'own-sleep')?.state).toBe('stun');
      expect(current().players[opponent].scene.find(character => character.uid === 'protected-sleep')?.state, 'B06071/B06071P non-targeting all-sleeping effect').toBe('stun');
    },
  );
});

function b06072UseState(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 160, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].case.traits = ['YAIBA'];
  state.players[owner].file = Array.from({ length: 8 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [card.id];
  return state;
}

describe('official QA Wave160: B06072 sequential enter branches', () => {
  it.each([B06072, B06072P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner resolves only the level-seven-or-lower branch at fourteen or less',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = b06072UseState(card, owner);
      state.players[opponent].scene = [sceneChar(LOW.id, 'low'), sceneChar(HIGH.id, 'high')];
      install(state, owner, `${card.id}-${owner}-low-branch`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const pick = pendingPick('sceneToDeck', card.id, 'a2');
      expect(pick.candidates.map(candidate => candidate.uid)).toContain('low');
      expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('high');
      choose(pick, 'low');

      expect(current().players[opponent].scene.map(character => character.uid)).toEqual(['high']);
      expect(current().players[opponent].deck.at(-1)).toBe(LOW.id);
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[opponent].hand).toEqual([]);
      expect(current().players[opponent].evidence).toEqual([]);
    },
  );

  it.each([B06072, B06072P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner rechecks fifteen-plus after the low branch removes a YAIBA set card',
    ({ card, owner }) => {
      const opponent = other(owner);
      const state = b06072UseState(card, owner);
      state.players[owner].remove = Array.from({ length: 14 }, () => YAIBA_REMOVED.id);
      state.players[owner].scene = [sceneChar(LOW.id, 'low-set-host', {
        setCards: [{ cardId: YAIBA_REMOVED.id, faceUp: true, instanceId: 'w160-yaiba-set' }],
      })];
      state.players[opponent].scene = [sceneChar(HIGH.id, 'second-target')];
      state.players[owner].deck = [DRAW_A.id, DRAW_B.id];
      state.players[opponent].hand = [COST.id];
      state.players[opponent].deck = [EVIDENCE.id, DRAW_A.id];
      install(state, owner, `${card.id}-${owner}-transition`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
        .toEqual({ ok: true });
      const lowPick = pendingPick('sceneToDeck', card.id, 'a2');
      choose(lowPick, 'low-set-host');

      const highPick = pendingPick('sceneToDeck', card.id, 'a2');
      expect(highPick.candidates.map(candidate => candidate.uid)).toContain('second-target');
      choose(highPick, null);

      expect(current().players[owner].scene.some(character => character.uid === 'low-set-host')).toBe(false);
      expect(current().players[owner].remove).toEqual([]);
      expect(current().players[owner].hand).toHaveLength(1);
      expect(current().players[opponent].hand).toEqual([]);
      expect(current().players[opponent].remove).toContain(COST.id);
      expect(current().players[opponent].evidence.at(-1)).toMatchObject({ cardId: EVIDENCE.id, faceUp: false });
    },
  );
});
