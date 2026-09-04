// qa: card:B06020:d3b7730aa0d24dcbd34fa32b3419352d1238d398c3f73d60ca2d4f1125207a8c
// qa: card:B06020:19859600f0b7fb132d4bc3da0e2c962fc9d85cb1c626d221e15e78f42f2a4c88
// qa: card:B06020:b50a8af517a68c456a51613c3b05839873884ae9861897261010e179a7625ade
// qa: card:B06020:87ca22fac9069dba0ae35a8316c041f1929afc422da2a7ecd4c6938cc50c0ff5
// qa: card:B06020:719ad960d0dfbc9c6146b9e1f646c60a4f1b85e4fbf634d711643b71c7f8f4e0
// qa: card:B06020:d382a7fc6e4702740cff1f11bd9d38e1f26b60b01597860ee5b20cfae1c5b1d0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06020 } from '@/cards/ct-p06/B06020';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { canCutIn, canDisguise } from '@/engine/flow/contact';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ACTOR = fixture('W130_ACTOR', { ap: 5000 });
const TARGET = fixture('W130_TARGET', { ap: 1000 });
const AURA_CUTIN = fixture('W130_AURA_CUTIN', {
  colors: ['緑'], traits: ['YAIBA'], ap: 1000,
});
const PRINTED_CUTIN = fixture('W130_PRINTED_CUTIN', {
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    description: 'Wave130 Cut-In sentinel.', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const DISGUISE = fixture('W130_DISGUISE', {
  abilities: [{ id: 'disguise', type: 'icon-disguise', description: 'Wave130 disguise.', ruleRefs: ['rules/09-cutin-disguise.md'] }],
});
const PROTECTED = fixture('W130_PROTECTED', {
  abilities: [{
    id: 'protected', type: 'continuous', scope: 'on-scene',
    continuousModifier: { untargetableByOppEffect: true },
    description: 'Wave130 protected target.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const COSTS = [
  fixture('W130_COST_1', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W130_COST_2', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W130_COST_3', { kind: 'event', ap: undefined, lp: undefined }),
] as const;
const TAIL = fixture('W130_TAIL', { kind: 'event', ap: undefined, lp: undefined });

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

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave130 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave130 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave130-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function finishContact(actionId: string): void {
  for (let step = 0; step < 20 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = actionContext(actionId);
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

function hookCounts(): Record<string, number> {
  const counts: Record<string, number> = {
    'action:declare': 0, 'action:end': 0, 'contact:start': 0, 'contact:end': 0,
  };
  for (const hook of Object.keys(counts)) {
    event.on(hook as never, () => { counts[hook] += 1; });
  }
  return counts;
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
  for (const card of [ACTOR, TARGET, AURA_CUTIN, PRINTED_CUTIN, DISGUISE, PROTECTED, ...COSTS, TAIL]) {
    register(card);
  }
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave130: granted hand Cut-In resolves normally and moves the card to remove', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 13, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(ACTOR.id, 'actor')];
    state.players[owner].hand = [B06020.id, AURA_CUTIN.id];
    state.players[opponent].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
    install(state, owner, `aura-${owner}`);
    expect(B06020.id).toBe('B06020');

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    let action = actionContext(actionId);
    const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
    const actingPlayer = current().players[owner].scene.some(character => character.uid === actingUid)
      ? owner
      : opponent;
    if (actingPlayer !== owner) {
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: actingPlayer, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      action = actionContext(actionId);
    }
    expect(canCutIn(current(), action, owner, AURA_CUTIN.id)).toBe(true);
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: owner, choice: { kind: 'cutin', cardId: AURA_CUTIN.id },
    })).toEqual({ ok: true });
    expect(current().players[owner].hand).toContain(B06020.id);
    expect(current().players[owner].hand).not.toContain(AURA_CUTIN.id);
    expect(current().players[owner].remove).toContain(AURA_CUTIN.id);
    expect(readChar.ap(current(), 'actor')).toBe(7000);
  });
});

describe('official QA Wave130: declared effect contact skips action/guard posture and keeps contact rules', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 13, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B06020.id, 'source')];
    state.players[owner].deck = [...COSTS.map(card => card.id), TAIL.id];
    state.players[owner].hand = [PRINTED_CUTIN.id, DISGUISE.id];
    state.players[opponent].scene = [
      sceneChar(TARGET.id, 'target'),
      sceneChar(PROTECTED.id, 'protected'),
    ];
    state.players[opponent].hand = [PRINTED_CUTIN.id, DISGUISE.id];
    install(state, owner, `contact-${owner}`);
    const hooks = hookCounts();

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'bindPick',
      source: { uid: 'source', cardId: B06020.id, abilityId: 'a2' },
    });
    expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['target']);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: 'target',
    }))).toEqual({ ok: true });

    const actionId = useGameStateStore.getState().activeActionId!;
    const action = actionContext(actionId);
    expect(action).toMatchObject({
      byUid: 'source', generatedByEffect: true, phase: 'action-1',
      target: { kind: 'char', uid: 'target' },
    });
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state)
      .toBe('sleep');
    expect(current().players[opponent].scene.find(character => character.uid === 'target')?.state)
      .toBe('active');
    expect(current().players[owner].remove).toEqual(COSTS.map(card => card.id));
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(canCutIn(current(), action, owner, PRINTED_CUTIN.id)).toBe(true);
    expect(canCutIn(current(), action, opponent, PRINTED_CUTIN.id)).toBe(true);
    expect(canDisguise(current(), action, owner, DISGUISE.id)).toBe(true);
    expect(canDisguise(current(), action, opponent, DISGUISE.id)).toBe(true);

    finishContact(actionId);
    expect(hooks).toEqual({
      'action:declare': 0,
      'action:end': 0,
      'contact:start': 1,
      'contact:end': 1,
    });
  });
});
