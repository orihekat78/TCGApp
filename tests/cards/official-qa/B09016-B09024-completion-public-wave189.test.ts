// qa: card:B09016:8d2d79973300c910aa8b160f07aabc86cbdb7d97fa97745452c640db361be527
// qa: card:B09017:d95b8a90fc8ae31ba0f4daea26a25aa50ed87eebfb5b29023ee562c1766bd4c0
// qa: card:B09021:a113c965536a7bbbe869d31fd70f9251ba261c54a3a0116b5c1c298f632d15b0
// qa: card:B09022:b17d52d4d40085539a6c7d5fefed1f616aa29562da88ebe10bd5ab1e6be37121
// qa: card:B09023:a649379465a8921aa4c601c5653f1fc6f096d4ee1a41dffa2a593c6228a2e2fa
// qa: card:B09024:85898367b278bf0d7685644bf2a96f2792bd858807714c2498c07bf5d020db6e
// qa: card:B09024:2f27486500c39be15653f1aac1f4241fccfc59ad094037cc273d60c957262fc5
// qa: card:B09024:88708bfce2f124b0c7d2e8715a0cf0f986e9ef18978a149b705e69186ff6017f

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09016 } from '@/cards/ct-p09/B09016';
import { B09017 } from '@/cards/ct-p09/B09017';
import { B09021 } from '@/cards/ct-p09/B09021';
import { B09022 } from '@/cards/ct-p09/B09022';
import { B09023 } from '@/cards/ct-p09/B09023';
import { B09024 } from '@/cards/ct-p09/B09024';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { canCutIn, canDisguise, disguise } from '@/engine/flow/contact';
import { flow } from '@/engine/flow';
import {
  _resetMisreadRegistered,
  _resetPendingMisread,
  registerMisreadListener,
} from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, FileCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const COMPANION = fixture('W189_COMPANION', {
  names: ['江戸川コナン'], level: 4, traits: ['少年探偵団'],
});
const REASONER = fixture('W189_REASONER', { lp: 1 });
const DISGUISE_BASE = fixture('W189_DISGUISE_BASE', { level: 5, ap: 5000 });
const ATTACKER = fixture('W189_ATTACKER', { level: 5, ap: 5000 });
const AP_TARGET = fixture('W189_AP_TARGET', { ap: 3000 });
const FILE_TOP_CHAR = fixture('W189_FILE_TOP_CHAR', { level: 3 });
const FILE_LOWER = fixture('W189_FILE_LOWER', { kind: 'event' });
const CONTACT_VICTIM = fixture('W189_CONTACT_VICTIM', { level: 3 });
const DRAW_A = fixture('W189_DRAW_A', { kind: 'event' });
const DRAW_B = fixture('W189_DRAW_B', { kind: 'event' });
const TAIL = fixture('W189_TAIL', { kind: 'event' });
const OSAKA = fixture('W189_OSAKA', { traits: ['大阪府警'] });
const POLICE = fixture('W189_POLICE', { traits: ['警察'] });
const REMOVE_TARGET = fixture('W189_REMOVE_TARGET', { level: 7, ap: 7000 });
const SET_TOP = fixture('W189_SET_TOP', { kind: 'event' });

const FIXTURES = [
  COMPANION, REASONER, DISGUISE_BASE, ATTACKER, AP_TARGET, FILE_TOP_CHAR,
  FILE_LOWER, CONTACT_VICTIM, DRAW_A, DRAW_B, TAIL, OSAKA, POLICE,
  REMOVE_TARGET, SET_TOP,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function fileBack(cardId: string, faceUp = false): FileCard {
  return { type: 'card-back', cardId, ...(faceUp ? { faceUp: true } : {}) };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave189 game state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave189-${label}`);
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
  flow.action._resetActionContexts();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetMisreadRegistered();
  _resetPendingMisread();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  registerMisreadListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingMisread();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave189: B09016 reasoning window', () => {
  it.each(['self', 'opp'] as const)('owner=%s reactivates once, then becomes eligible only in a later reasoning', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09016.id, 'mitsu'), sceneChar(COMPANION.id, 'companion'),
    ];
    state.players[opponent].scene = [
      sceneChar(REASONER.id, 'reasoner-1'), sceneChar(REASONER.id, 'reasoner-2'),
    ];
    state.players[opponent].deck = [DRAW_A.id, DRAW_B.id, TAIL.id];
    install(state, owner, `${owner}-B09016-window`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner-1' })).toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingMisread!;
    expect(first.candidates).toEqual([{ uid: 'mitsu', x: 1 }]);
    expect(dispatchEngineAction(bindPendingDecision(first, {
      type: 'misreadResolve', picks: first.candidates,
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.find(card => card.uid === 'mitsu')?.state).toBe('active');
    expect(useGameStateStore.getState().pendingMisread).toBeNull();

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner-2' })).toEqual({ ok: true });
    const second = useGameStateStore.getState().pendingMisread!;
    expect(second.candidates).toEqual([{ uid: 'mitsu', x: 1 }]);
    expect(dispatchEngineAction(bindPendingDecision(second, {
      type: 'misreadResolve', picks: second.candidates,
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.find(card => card.uid === 'mitsu')?.state).toBe('sleep');
  });
});

describe('official QA Wave189: B09017 cut-in restriction', () => {
  it.each(['self', 'opp'] as const)('owner=%s blocks cut-in but permits the opponent disguise', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(ATTACKER.id, 'attacker'), sceneChar(B09017.id, 'ayumi'),
      sceneChar(COMPANION.id, 'companion'),
    ];
    state.players[opponent].scene = [sceneChar(DISGUISE_BASE.id, 'target')];
    state.players[opponent].hand = ['B03129'];
    state.players[opponent].file = Array.from({ length: 6 }, () => fileBack(TAIL.id));
    const action: ActionContext = {
      id: 'wave189-action', byUid: 'attacker', byPlayer: owner,
      target: { kind: 'char', uid: 'target' }, phase: 'action-1', cutInUsed: {},
      startedAt: { turn: 189, nano: 0 },
      apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: 'target', bAP: 5000 },
      contactImmune: false,
    };

    expect(canCutIn(state, action, opponent, 'B03129'), B09017.id).toBe(false);
    expect(canDisguise(state, action, opponent, 'B03129')).toBe(true);
    disguise(state, action, opponent, 'B03129');
    runAllUntilEmpty(state);
    expect(state.players[opponent].scene.find(card => card.uid === 'target')?.cardId).toBe('B03129');
  });
});

describe('official QA Wave189: independent FILE follow-up effects', () => {
  it.each(['self', 'opp'] as const)('owner=%s B09021 still grants AP when FILE top is already face-up', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '緑'];
    state.players[owner].scene = [sceneChar(B09021.id, 'hattori'), sceneChar(AP_TARGET.id, 'ap-target')];
    state.players[opponent].file = [fileBack(FILE_LOWER.id), fileBack(FILE_TOP_CHAR.id, true)];
    const fileBefore = structuredClone(state.players[opponent].file);
    install(state, owner, `${owner}-B09021-face-up`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'hattori', abilId: 'a2' }), B09021.id)
      .toEqual({ ok: true });
    const buff = pendingPick(B09021.id, 'a2', 'charModifyAP');
    expect(current().players[opponent].file).toEqual(fileBefore);
    choose(buff, 'ap-target');
    expect(read.char.ap(current(), 'ap-target')).toBe(4000);
  });

  it.each(['self', 'opp'] as const)('owner=%s B09023 does not flip a lower FILE card after contact removal', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '緑'];
    state.players[owner].scene = [sceneChar(B09023.id, 'okita')];
    state.players[opponent].scene = [sceneChar(CONTACT_VICTIM.id, 'victim')];
    state.players[opponent].file = [fileBack(FILE_LOWER.id), fileBack(FILE_TOP_CHAR.id, true)];
    const fileBefore = structuredClone(state.players[opponent].file);

    mutate.scene.removeToRemove(state, 'victim', 'contact-ap', 'okita');
    runAllUntilEmpty(state);
    expect(state.players[opponent].file, B09023.id).toEqual(fileBefore);
  });
});

describe('official QA Wave189: independent contact observer', () => {
  it.each(['self', 'opp'] as const)('owner=%s B09022 draws despite failing its enter partner/case gates', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.status = '事件編';
    state.players[owner].scene = [sceneChar(B09022.id, 'kazuha')];
    state.players[owner].deck = [DRAW_A.id, TAIL.id];
    state.players[opponent].scene = [sceneChar(CONTACT_VICTIM.id, 'victim')];

    mutate.scene.removeToRemove(state, 'victim', 'contact-ap', 'kazuha');
    runAllUntilEmpty(state);
    expect(state.players[owner].hand, B09022.id).toContain(DRAW_A.id);
  });
});

describe('official QA Wave189: B09024 granted triggers', () => {
  it.each(['self', 'opp'] as const)('owner=%s two bearers grant two independent leave triggers', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 189, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
    mutate.scene.enter(state, owner, B09024.id, {});
    mutate.scene.enter(state, owner, B09024.id, {});
    const recipient = mutate.scene.enter(state, owner, OSAKA.id, {});

    mutate.scene.removeToRemove(state, recipient.uid, 'effect');
    expect(state.pendingEffects.filter(entry => entry.triggeredBy?.hook === 'leave:to-remove'))
      .toHaveLength(2);
  });

  it.each(['self', 'opp'] as const)('owner=%s snapshots the granted trigger when bearer and recipient leave together', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 189, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
    const bearer = mutate.scene.enter(state, owner, B09024.id, {});
    const recipient = mutate.scene.enter(state, owner, OSAKA.id, {});
    const batch = mutate.scene as typeof mutate.scene & {
      removeToRemoveBatch: (game: GameState, uids: string[], cause: 'effect') => void;
    };

    batch.removeToRemoveBatch(state, [bearer.uid, recipient.uid], 'effect');
    expect(state.pendingEffects.filter(entry => entry.triggeredBy?.hook === 'leave:to-remove'))
      .toHaveLength(1);
  });
});

describe('official QA Wave189: B09024 reveal-cost lifetime', () => {
  it.each(['self', 'opp'] as const)('owner=%s may hide the cost reveal before choosing the effect target', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 189, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].partner.cardId = B09024.id;
    state.players[owner].scene = [sceneChar(B09024.id, 'heizo')];
    state.players[owner].hand = [POLICE.id];
    state.players[owner].deck = [SET_TOP.id, TAIL.id];
    state.players[opponent].scene = [sceneChar(REMOVE_TARGET.id, 'remove-target', { state: 'sleep' })];
    install(state, owner, `${owner}-B09024-reveal`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'heizo', abilId: 'a2',
      costParams: { revealFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    const removal = pendingPick(B09024.id, 'a2', 'sceneRemove');
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, cardIds: [POLICE.id], lifetime: 'presentation',
    });
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick?.resolutionToken).toBe(removal.resolutionToken);

    choose(removal, 'remove-target');
    expect(current().players[opponent].remove).toContain(REMOVE_TARGET.id);
    expect(current().players[owner].scene.find(card => card.uid === 'heizo')?.setCards)
      .toEqual([expect.objectContaining({ cardId: SET_TOP.id, faceUp: false })]);
  });
});
