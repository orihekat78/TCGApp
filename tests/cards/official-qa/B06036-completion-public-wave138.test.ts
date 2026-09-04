// qa: card:B06036:30a7759896adeb54b8229a3083eb1615ae39b079a34bba004f00f993c0a898c9
// qa: card:B06036:6ee4a10e2ff400f6f8c294d10796758725ac4c53cb03413068a05486710358b5
// qa: card:B06036:842042d11ef8ee69a0de81391490f90ee08e72e98ba9e0a4e7c61db69c87146c
// qa: card:B06036:d5b4f1f14f3bfa7b4acbb66e917288698e5ab0f84fa0714f86cd8196f9554e79
// qa: card:B06036:ef8f1c5c8c1abdc6f70dd0cbdf073b3d8c558f5feeca4c12d99122b337875843

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05079 } from '@/cards/ct-p05/B05079';
import { B06025 } from '@/cards/ct-p06/B06025';
import { B06026 } from '@/cards/ct-p06/B06026';
import { B06036 } from '@/cards/ct-p06/B06036';
import { B06036P } from '@/cards/ct-p06/B06036P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetHiramekiRegistered, _resetPendingHirameki, registerHiramekiListener } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const hiramekiDraw: AbilityDef = {
  id: 'hirameki', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave138 Hirameki draw.', ruleRefs: ['rules/10-action-event.md'],
};

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HIR_DRAW = fixture('W138_HIR_DRAW', { traits: ['YAIBA'], abilities: [hiramekiDraw] });
const HIR_BLOCKED = fixture('W138_HIR_BLOCKED', {
  traits: ['YAIBA'],
  abilities: [{ ...hiramekiDraw, condition: { kind: 'partnerColor', color: '青' } }],
});
const EV_A = fixture('W138_EV_A');
const EV_B = fixture('W138_EV_B');
const EV_C = fixture('W138_EV_C');
const EV_D = fixture('W138_EV_D');
const EV_E = fixture('W138_EV_E');
const TARGET = fixture('W138_TARGET');
const DRAW = fixture('W138_DRAW', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W138_TAIL', { kind: 'event', ap: undefined, lp: undefined });
const PRINTINGS = [B06036, B06036P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false) {
  return { cardId, faceUp, origin: { turn: 31, via: 'reasoning' as const } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave138 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave138-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(printing: CardDef, owner: Player, evidenceCards: ReturnType<typeof evidence>[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 31, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.cardId = printing.id;
  state.players[owner].case.status = '解決編';
  state.players[owner].case.colors = ['緑'];
  state.players[owner].evidence = evidenceCards;
  state.players[owner].deck = [DRAW.id, TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id];
  return state;
}

function declare(owner: Player, indices: number[]) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { flipFaceUpEvidence: { indices } },
  });
}

function pendingPick(verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb).toBe(verb);
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof pendingPick>>, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function chooseInvoked(cardId: string): void {
  const invoke = pendingPick('invokeHiramekiOfCard');
  const candidate = invoke.candidates.find(item => item.cardId === cardId);
  expect(candidate).toMatchObject({ cardId, area: 'evidence' });
  choose(invoke, candidate!.uid);
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  registerAll();
  for (const card of [HIR_DRAW, HIR_BLOCKED, EV_A, EV_B, EV_C, EV_D, EV_E, TARGET, DRAW, TAIL]) register(card);
  registerTriggeredListener();
  registerHiramekiListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave138: invoked Hirameki movement uses the paid occurrence', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner moves Kerosuke from evidence after its whole effect', ({ printing, owner }) => {
    const opponent = other(owner);
    const state = base(printing, owner, [evidence(B06025.id), evidence(EV_A.id), evidence(EV_B.id)]);
    state.players[owner].scene = [sceneChar(TARGET.id, 'target')];
    state.players[opponent].scene = [sceneChar(TARGET.id, 'opponent-decoy')];
    install(state, owner, `${printing.id}-${owner}-kerosuke`);

    expect(declare(owner, [0, 1, 2])).toEqual({ ok: true });
    chooseInvoked(B06025.id);
    const removal = pendingPick('sceneRemove');
    expect(removal.candidates.map(candidate => candidate.uid)).toContain('target');
    expect(removal.candidates.map(candidate => candidate.uid)).not.toContain('opponent-decoy');
    choose(removal, 'target');

    expect(current().players[owner].remove).toContain(TARGET.id);
    expect(current().players[owner].scene.some(character => character.cardId === B06025.id)).toBe(true);
    expect(current().players[owner].evidence.some(item => item.cardId === B06025.id)).toBe(false);
    expect(current().players[opponent].scene.map(character => character.uid)).toContain('opponent-decoy');
  });
});

describe('official QA Wave138: invoke exceptions remain owner-relative', () => {
  it.each(['self', 'opp'] as const)('owner %s bypasses Hirameki suppression', owner => {
    const opponent = other(owner);
    const state = base(B06036, owner, [evidence(HIR_DRAW.id), evidence(EV_A.id), evidence(EV_B.id)]);
    state.players[opponent].scene = [sceneChar(B05079.id, 'sera')];
    install(state, owner, `${owner}-suppression`);

    expect(declare(owner, [0, 1, 2])).toEqual({ ok: true });
    chooseInvoked(HIR_DRAW.id);
    expect(current().players[owner].hand).toEqual([DRAW.id]);
  });

  it.each(['self', 'opp'] as const)('owner %s may invoke a condition-disabled effect with no result', owner => {
    const state = base(B06036, owner, [evidence(HIR_BLOCKED.id), evidence(EV_A.id), evidence(EV_B.id)]);
    install(state, owner, `${owner}-condition-disabled`);

    expect(declare(owner, [0, 1, 2])).toEqual({ ok: true });
    chooseInvoked(HIR_BLOCKED.id);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[owner].hand).toEqual([]);
    expect(current().players[owner].evidence[0]).toMatchObject({ cardId: HIR_BLOCKED.id, faceUp: true });
  });

  it.each(['self', 'opp'] as const)('owner %s may turn the selected B06026 occurrence face-down', owner => {
    const state = base(B06036, owner, [evidence(B06026.id), evidence(EV_A.id), evidence(EV_B.id)]);
    install(state, owner, `${owner}-batman-self-flip`);

    expect(declare(owner, [0, 1, 2])).toEqual({ ok: true });
    chooseInvoked(B06026.id);
    const flip = pendingPick('evidenceFlipDown');
    const source = flip.candidates.find(candidate => candidate.cardId === B06026.id);
    expect(source).toMatchObject({ cardId: B06026.id, player: owner, area: 'evidence', index: 0 });
    choose(flip, source!.uid);
    expect(current().players[owner].evidence[0]).toMatchObject({ cardId: B06026.id, faceUp: false });
  });
});

describe('official QA Wave138: exact-three cost keeps arbitrary positions and order', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const cards = [EV_A.id, EV_B.id, EV_C.id, EV_D.id, EV_E.id];
    const state = base(printing, owner, cards.map(cardId => evidence(cardId)));
    const identities = structuredClone(state.players[owner].evidence.map(item => ({ cardId: item.cardId, origin: item.origin })));
    install(state, owner, `${printing.id}-${owner}-positions`);

    expect(declare(owner, [4, 0, 2])).toEqual({ ok: true });
    expect(current().players[owner].evidence.map(item => ({ cardId: item.cardId, origin: item.origin })))
      .toEqual(identities);
    expect(current().players[owner].evidence.map(item => item.faceUp))
      .toEqual([true, false, true, false, true]);
  });
});
