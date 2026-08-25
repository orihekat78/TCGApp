// qa: card:B08049:190baa1e1f03afa7d9e83de8ff7b5f6134452bd6b3a05caf22783df26c2a9ea8
// qa: card:B08049:6da58a7c708a81d4e493e03cd5972d77b0c8624160b1378ad4de6cef3faa2134
// qa: card:B08049:adeccaf4d2c55031342acd5845bc598092ff4988133418d1340069dfc30c48bc
// qa: card:B08049:b6cd283a3bf7b22de562ba31cd0a131cd118aec7817989769dd9e6dd9dbae5c1
// qa: card:B08049:f0398d124b6fcf182121b37e2ce8a1ea1e395f7d5bb1bf0c8dad9c2beb24d74e
// qa: card:B08049:f34bda62bcbe6ba6cb83e5cc60fb12f6226a4f7088025e428e5bf0b6c3649993

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08049 } from '@/cards/ct-p08/B08049';
import { B08049P } from '@/cards/ct-p08/B08049P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B08049, B08049P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const FBI = fixture('W132_FBI', { traits: ['FBI'], ap: 6000 });
const IDLE_FBI = fixture('W132_IDLE_FBI', { traits: ['FBI'], ap: 2000 });
const TARGET = fixture('W132_TARGET', { ap: 1000 });
const GUARDER = fixture('W132_GUARDER', { ap: 3000 });
const DRAW = fixture('W132_DRAW', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W132_TAIL', { kind: 'event', ap: undefined, lp: undefined });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave132 state');
  return state;
}

function actionContext(actionId: string): ActionContext | undefined {
  return current().actionContexts?.[actionId];
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave132-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function endPhaseState(card: CardDef, owner: Player, otherFbi: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 17, player: owner, phase: 'end', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(card.id, 'source'),
    ...Array.from({ length: otherFbi }, (_value, index) => sceneChar(FBI.id, `fbi-${index + 1}`)),
  ];
  state.players[owner].deck = [DRAW.id, TAIL.id, TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id, TAIL.id];
  return state;
}

function resolveEndTrigger(
  card: CardDef,
  owner: Player,
  otherFbi: number,
  mutateBeforeResolution: (state: GameState) => void,
): GameState {
  const state = endPhaseState(card, owner, otherFbi);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  event.emit(state, 'phase:end:start', { player: owner });
  mutateBeforeResolution(state);
  runAllUntilEmpty(state);
  return state;
}

function finishAction(actionId: string): void {
  for (let step = 0; step < 20 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = actionContext(actionId);
    if (!action) break;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === actingUid)
        ? 'self'
        : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    }
    if (useGameStateStore.getState().activeActionId === actionId) {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [FBI, IDLE_FBI, TARGET, GUARDER, DRAW, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave132: turn-end FBI count and draw use resolution-time state', () => {
  it.each(CASES)('$card.id owner $owner counts itself and draws mandatorily', ({ card, owner }) => {
    const state = endPhaseState(card, owner, 3);
    state.turn.phase = 'main';
    install(state, owner, `${card.id}-${owner}-public-end`);
    expect([B08049.id, B08049P.id]).toContain(card.id);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([DRAW.id]);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(CASES)('$card.id owner $owner rechecks the count and survives source leave', ({ card, owner }) => {
    const becameTrue = resolveEndTrigger(card, owner, 2, state => {
      state.players[owner].scene.push(sceneChar(FBI.id, 'late-fbi'));
    });
    expect(becameTrue.players[owner].hand).toEqual([DRAW.id]);

    const sourceLeft = resolveEndTrigger(card, owner, 4, state => {
      mutate.scene.removeToRemove(state, 'source', 'effect');
    });
    expect(sourceLeft.players[owner].remove).toContain(card.id);
    expect(sourceLeft.players[owner].hand).toEqual([DRAW.id]);

    const becameFalse = resolveEndTrigger(card, owner, 3, state => {
      mutate.scene.removeToRemove(state, 'source', 'effect');
    });
    expect(becameFalse.players[owner].hand).toEqual([]);
  });
});

describe('official QA Wave132: real action history drives the declared reactivation', () => {
  it.each(CASES)('$card.id owner $owner admits the actor, not guarded/idle cards, even when active', ({ card, owner }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 17, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(card.id, 'source'),
      sceneChar(FBI.id, 'actor'),
      sceneChar(IDLE_FBI.id, 'idle', { state: 'sleep' }),
    ];
    state.players[opponent].scene = [
      sceneChar(TARGET.id, 'target', { state: 'sleep' }),
      sceneChar(GUARDER.id, 'guarder'),
    ];
    install(state, owner, `${card.id}-${owner}-acted`);
    expect([B08049.id, B08049P.id]).toContain(card.id);

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(current().players[owner].scene.find(character => character.uid === 'actor')?.turnEffects)
      .toMatchObject({ actedCharThisTurn: true });
    expect(current().players[opponent].scene.find(character => character.uid === 'target')?.turnEffects)
      .not.toMatchObject({ actedCharThisTurn: true });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: true });
    const guardLeft = structuredClone(current());
    mutate.scene.removeToRemove(guardLeft, 'guarder', 'effect');
    expect(useGameStateStore.getState().setGameState(guardLeft)).toBe(true);
    finishAction(actionId);
    expect(current().players[owner].scene.find(character => character.uid === 'actor')?.turnEffects)
      .toMatchObject({ actedCharThisTurn: true });
    expect(current().players[opponent].scene.find(character => character.uid === 'target')?.turnEffects)
      .not.toMatchObject({ actedCharThisTurn: true });

    const reactivated = structuredClone(current());
    reactivated.players[owner].scene.find(character => character.uid === 'actor')!.state = 'active';
    expect(useGameStateStore.getState().setGameState(reactivated)).toBe(true);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'sceneSetState',
      source: { uid: 'source', cardId: card.id, abilityId: 'a2' },
    });
    expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['actor']);
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state)
      .toBe('sleep');
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: 'actor',
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'actor')?.state)
      .toBe('active');

    const retry = structuredClone(current());
    retry.players[owner].scene.find(character => character.uid === 'source')!.state = 'active';
    expect(useGameStateStore.getState().setGameState(retry)).toBe(true);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: false, reason: 'not-allowed' });
  });
});
