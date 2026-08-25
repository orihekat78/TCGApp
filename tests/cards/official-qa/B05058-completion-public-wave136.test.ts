// qa: card:B05058:005869b804a7f1211f4012d0d1923a1b445b97f955eaa4b6df86b2644fff0648
// qa: card:B05058:357bc184b1a324a6e8f0c47236894c6098a8a9bf9d216a5f53ab86712037a2e5
// qa: card:B05058:4e82e2fe3cfc0d7139d5666a6ad3aa65aa6c2dcd36e5545cd1459c54cabe9bef
// qa: card:B05058:9cb4f3efe07731e877e24f34c590c505e2177cf9744d67ee083402926e951277
// qa: card:B05058:d533b0ca0d9e25659d4cafd5fa63d742a17440de2bd15b1323712ffad0513e08

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05058 } from '@/cards/ct-p05/B05058';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import type { ActionContext, CardDef, EffectCtx, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ATTACKER = fixture('W136_ATTACKER', { ap: 8000 });
const SUZUKI = fixture('W136_SUZUKI', { traits: ['鈴木財閥'] });
const DECOY = fixture('W136_DECOY', { traits: ['絵描き'] });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['白'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave136 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave136 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave136-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function contactState(owner: Player): GameState {
  const attacker = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 25, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(B05058.id, 'source', { state: 'sleep' })];
  state.players[owner].remove = [SUZUKI.id, DECOY.id];
  state.players[attacker].scene = [sceneChar(ATTACKER.id, 'attacker')];
  return state;
}

function removeThroughContact(owner: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
    .toEqual({ ok: true });
  for (let step = 0; step < 20; step += 1) {
    const action = actionContext(actionId);
    if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      break;
    }
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players[owner].scene.some(character => character.uid === actingUid)
        ? owner
        : other(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    } else {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  return actionId;
}

function pendingRecovery(owner: Player) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: owner, ownerPlayer: owner, atomVerb: 'handAddFromRemove', nMin: 0, nMax: 1,
    source: { uid: 'source', cardId: B05058.id, abilityId: 'a2' },
  });
  expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([SUZUKI.id]);
  return pending!;
}

function settleAction(actionId: string): void {
  for (let step = 0; step < 4 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
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
  for (const card of [ATTACKER, SUZUKI, DECOY]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave136: Suzuki Zaibatsu is granted only to the scene occurrence', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const state = createEmptyGameState();
    state.players[owner].scene = [sceneChar(B05058.id, 'source')];
    state.players[owner].hand = [B05058.id, SUZUKI.id];
    state.players[owner].deck = [B05058.id, SUZUKI.id];
    state.players[owner].remove = [B05058.id, SUZUKI.id];
    const ctx = {
      source: { player: owner, cardId: B05058.id, uid: 'source', abilityId: 'a1', area: 'scene' },
      bindings: {},
    } as EffectCtx;

    expect(B05058.id).toBe('B05058');
    expect(B05058.traits).toEqual(['絵描き']);
    expect(readChar.traits(state, 'source')).toEqual(expect.arrayContaining(['絵描き', '鈴木財閥']));
    for (const area of ['hand', 'deck', 'remove'] as const) {
      expect(candidates(state, {
        kind: 'all', query: { area, side: 'self', filter: { kind: 'character', trait: '鈴木財閥' } },
      } as never, ctx).map(candidate => candidate.cardId)).toEqual([SUZUKI.id]);
    }
  });
});

describe('official QA Wave136: opponent-turn leave recovers another printed-trait card only', () => {
  it.each(['self', 'opp'] as const)('owner %s accepts or declines the public recovery', owner => {
    install(contactState(owner), owner, `${owner}-take`);
    const actionId = removeThroughContact(owner);
    expect(current().players[owner].remove).toContain(B05058.id);
    const pending = pendingRecovery(owner);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([SUZUKI.id]);
    expect(current().players[owner].remove).toContain(B05058.id);
    settleAction(actionId);

    install(contactState(owner), owner, `${owner}-decline`);
    const declineActionId = removeThroughContact(owner);
    const decline = pendingRecovery(owner);
    expect(dispatchEngineAction(bindPendingDecision(decline, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual([]);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([SUZUKI.id, B05058.id]));
    settleAction(declineActionId);
  });
});
