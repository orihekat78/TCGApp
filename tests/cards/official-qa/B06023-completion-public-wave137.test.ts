// qa: card:B06023:0025cb3b7aecab7dca31296259c4dca893915c9eb6eecce256504c10d3ebd07d
// qa: card:B06023:30a7759896adeb54b8229a3083eb1615ae39b079a34bba004f00f993c0a898c9
// qa: card:B06023:318e0b4ddb5668092bec5b9d46b3eb38676ff0524d7b683ec38006c983e016f3
// qa: card:B06023:6ee4a10e2ff400f6f8c294d10796758725ac4c53cb03413068a05486710358b5
// qa: card:B06023:d5b4f1f14f3bfa7b4acbb66e917288698e5ab0f84fa0714f86cd8196f9554e79

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05079 } from '@/cards/ct-p05/B05079';
import { B06023 } from '@/cards/ct-p06/B06023';
import { B06025 } from '@/cards/ct-p06/B06025';
import { B06026 } from '@/cards/ct-p06/B06026';
import { B06027 } from '@/cards/ct-p06/B06027';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetHiramekiRegistered, _resetPendingHirameki, registerHiramekiListener } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
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
  description: 'Wave137 Hirameki draw.', ruleRefs: ['rules/10-action-event.md'],
};
const HIR_DRAW = fixture('W137_HIR_DRAW', { traits: ['YAIBA'], abilities: [hiramekiDraw] });
const HIR_BLOCKED = fixture('W137_HIR_BLOCKED', {
  traits: ['YAIBA'],
  abilities: [{ ...hiramekiDraw, condition: { kind: 'partnerColor', color: '青' } }],
});
const EVIDENCE_DECOY = fixture('W137_EVIDENCE_DECOY');
const TARGET = fixture('W137_TARGET', { ap: 1000 });
const DRAW = fixture('W137_DRAW', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W137_TAIL', { kind: 'event', ap: undefined, lp: undefined });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false) {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' as const } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave137 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave137-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(owner: Player, evidenceCards: ReturnType<typeof evidence>[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 27, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = '解決編';
  state.players[owner].case.colors = ['緑'];
  state.players[owner].scene = [sceneChar(B06023.id, 'source')];
  state.players[owner].evidence = evidenceCards;
  state.players[owner].deck = [DRAW.id, TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id];
  return state;
}

function declare(index: number): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { flipFaceUpEvidence: { indices: [index] } },
  });
}

function acceptInvoke(): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({
    player: expect.any(String), source: { uid: 'source', cardId: B06023.id, abilityId: 'a2' },
  });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function resolveInvoked(owner: Player, childCardId: string): void {
  const group = pendingOwnerOrderGroup(current(), owner);
  expect(group.map(entry => entry.source.cardId)).toContain(childCardId);
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: owner, entryIds: group.map(entry => entry.id),
  })).toEqual({ ok: true });
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
  for (const card of [HIR_DRAW, HIR_BLOCKED, EVIDENCE_DECOY, TARGET, DRAW, TAIL]) register(card);
  registerTriggeredListener();
  registerHiramekiListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave137: public cost binds the exact evidence occurrence', () => {
  it.each(['self', 'opp'] as const)('owner %s bypasses Hirameki suppression for the selected effect', owner => {
    const opponent = other(owner);
    const state = base(owner, [evidence(EVIDENCE_DECOY.id), evidence(HIR_DRAW.id)]);
    state.players[opponent].scene = [sceneChar(B05079.id, 'sera')];
    install(state, owner, `${owner}-suppressed`);
    expect(B06023.id).toBe('B06023');

    expect(declare(1)).toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state)
      .toBe('sleep');
    expect(current().players[owner].evidence.map(item => ({ cardId: item.cardId, faceUp: item.faceUp })))
      .toEqual([
        { cardId: EVIDENCE_DECOY.id, faceUp: false },
        { cardId: HIR_DRAW.id, faceUp: true },
      ]);
    acceptInvoke();
    resolveInvoked(owner, HIR_DRAW.id);
    expect(current().players[owner].hand).toEqual([DRAW.id]);
  });

  it.each(['self', 'opp'] as const)('owner %s rejects an already face-up evidence cost atomically', owner => {
    const state = base(owner, [evidence(HIR_DRAW.id, true)]);
    install(state, owner, `${owner}-invalid-cost`);
    const before = current();

    expect(declare(0)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players[owner].evidence[0]).toMatchObject({ cardId: HIR_DRAW.id, faceUp: true });
    expect(current().players[owner].scene[0]).toMatchObject({ uid: 'source', state: 'active' });
    expect(readChar.declaredUseCount(current(), 'source', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(0);
  });
});

describe('official QA Wave137: invoked Hirameki honors its whole effect and own condition', () => {
  it.each(['self', 'opp'] as const)('owner %s resolves all of Kerosuke and moves its occurrence', owner => {
    const opponent = other(owner);
    const state = base(owner, [evidence(B06025.id)]);
    state.players[owner].scene.push(sceneChar(TARGET.id, 'target'));
    state.players[opponent].scene = [sceneChar(TARGET.id, 'opponent-decoy')];
    const evidenceRemovedPlayers: Player[] = [];
    event.on('evidence:removed', (_draft, payload) => {
      evidenceRemovedPlayers.push((payload as { player: Player }).player);
    });
    install(state, owner, `${owner}-kerosuke`);

    expect(declare(0)).toEqual({ ok: true });
    acceptInvoke();
    resolveInvoked(owner, B06025.id);
    const removal = pendingPick('sceneRemove');
    expect(removal.candidates.map(candidate => candidate.uid)).toContain('target');
    expect(removal.candidates.map(candidate => candidate.uid)).not.toContain('opponent-decoy');
    choose(removal, removal.candidates.find(candidate => candidate.uid === 'target')!.uid);

    expect(current().players[owner].remove).toContain(TARGET.id);
    expect(current().players[opponent].scene.map(character => character.uid)).toContain('opponent-decoy');
    expect(current().players[owner].scene.some(character => character.cardId === B06025.id)).toBe(true);
    expect(current().players[owner].evidence.some(item => item.cardId === B06025.id)).toBe(false);
    expect(evidenceRemovedPlayers).toEqual([]);
    surfacePendingSideChannels();
    const choice = useGameStateStore.getState().pendingEffectChoice;
    if (choice) {
      expect(dispatchEngineAction(bindPendingDecision(choice, {
        type: 'choiceResolve', choiceIndex: 0,
      }))).toEqual({ ok: true });
    }
  });

  it.each(['self', 'opp'] as const)('owner %s may invoke a condition-disabled Hirameki with no result', owner => {
    const state = base(owner, [evidence(HIR_BLOCKED.id)]);
    install(state, owner, `${owner}-condition-disabled`);

    expect(declare(0)).toEqual({ ok: true });
    acceptInvoke();
    expect(pendingOwnerOrderGroup(current(), owner)).toEqual([]);
    expect(current().players[owner].hand).toEqual([]);
    expect(current().players[owner].evidence[0]).toMatchObject({ cardId: HIR_BLOCKED.id, faceUp: true });
  });

  it.each(['self', 'opp'] as const)('owner %s may turn the invoked B06026 occurrence face-down', owner => {
    const state = base(owner, [evidence(EVIDENCE_DECOY.id, true), evidence(B06026.id)]);
    install(state, owner, `${owner}-batman-self-flip`);

    expect(declare(1)).toEqual({ ok: true });
    acceptInvoke();
    resolveInvoked(owner, B06026.id);
    const flip = pendingPick('evidenceFlipDown');
    const source = flip.candidates.find(candidate => candidate.cardId === B06026.id);
    expect(source).toMatchObject({ cardId: B06026.id, player: owner, area: 'evidence', index: 1 });
    choose(flip, source!.uid);

    expect(current().players[owner].evidence).toEqual([
      expect.objectContaining({ cardId: EVIDENCE_DECOY.id, faceUp: true }),
      expect.objectContaining({ cardId: B06026.id, faceUp: false }),
    ]);
  });

  it.each(['self', 'opp'] as const)('owner %s switches an exact own character for invoked Kamen Yaiba entry', owner => {
    const opponent = other(owner);
    const state = base(owner, [evidence(B06027.id)]);
    state.players[owner].scene.push(
      sceneChar(TARGET.id, 'switch-victim'),
      sceneChar(TARGET.id, 'keep-1'),
      sceneChar(TARGET.id, 'keep-2'),
      sceneChar(TARGET.id, 'keep-3'),
    );
    state.players[opponent].scene = [sceneChar(TARGET.id, 'opponent-decoy')];
    install(state, owner, `${owner}-kamen-yaiba-full-scene`);

    expect(declare(0)).toEqual({ ok: true });
    acceptInvoke();
    resolveInvoked(owner, B06027.id);
    const switchPick = pendingPick('sceneEnter');
    expect(switchPick.candidates.map(candidate => candidate.uid)).toContain('switch-victim');
    expect(switchPick.candidates.map(candidate => candidate.uid)).not.toContain('opponent-decoy');
    choose(switchPick, 'switch-victim');

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(character => character.uid === 'switch-victim')).toBe(false);
    expect(current().players[owner].scene.at(-1)).toMatchObject({ cardId: B06027.id, state: 'sleep' });
    expect(current().players[owner].remove).toContain(TARGET.id);
    expect(current().players[owner].evidence.some(item => item.cardId === B06027.id)).toBe(false);
  });
});

describe('official QA Wave137: entry draw remains the public baseline', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 27, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['緑'];
    state.players[owner].file = Array.from({ length: 7 }, (_value, index) => ({
      type: 'card-back' as const, cardId: `file-${index}`,
    }));
    state.players[owner].hand = [B06023.id];
    state.players[owner].deck = [DRAW.id, TAIL.id];
    state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id];
    install(state, owner, `${owner}-entry-draw`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06023.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([DRAW.id]);
  });
});
