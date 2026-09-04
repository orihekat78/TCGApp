// qa: card:B10036:0b75452df6157fca2faca3660e38d13be769a1eae20e32990c76ac7780cdac0b
// qa: card:B10036:0e3dfbcf73fba8c1baffb2afa7eb5503c5d53cd160f8464c381e1443b574f1e4
// qa: card:B10036:19859600f0b7fb132d4bc3da0e2c962fc9d85cb1c626d221e15e78f42f2a4c88
// qa: card:B10036:3aa4146f97fd46d0740e059c0c44e75c2162022ccae7892209751e36cf009485
// qa: card:B10036:a3b35ffcf4a5f093bc190dfa9602fb31d3dae0f9f38cf489ee8396f481b8d3b0
// qa: card:B10036:fcd5db872cd38e14275a02c09c16471d493e46666205e305dcde43e1ee864fce

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10036, B10036P } from '@/cards/ct-p10/B10036';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { canCutIn, canDisguise } from '@/engine/flow/contact';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B10036, B10036P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const WHITE_PARTNER = fixture('W133_WHITE_PARTNER', { kind: 'partner', colors: ['白'], ap: undefined, lp: undefined });
const ACTOR = fixture('W133_ACTOR', { ap: 5000 });
const ACTIVE_DECOY = fixture('W133_ACTIVE_DECOY', { ap: 2000 });
const TARGET = fixture('W133_TARGET', { ap: 1000 });
const PROTECTED = fixture('W133_PROTECTED', {
  abilities: [{
    id: 'protected', type: 'continuous', scope: 'on-scene',
    continuousModifier: { untargetableByOppEffect: true },
    description: 'Wave133 protected target.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const CUTIN = fixture('W133_CUTIN', {
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    description: 'Wave133 Cut-In sentinel.', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const DISGUISE = fixture('W133_DISGUISE', {
  abilities: [{
    id: 'disguise', type: 'icon-disguise', description: 'Wave133 disguise.',
    ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
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
  if (!state) throw new Error('missing Wave133 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave133 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave133-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(card: CardDef, owner: Player): GameState {
  const opponent = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 19, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['緑', '白'];
  state.players[owner].case.status = '解決編';
  state.players[owner].partner = {
    cardId: WHITE_PARTNER.id, state: 'active', location: 'partner-area',
  };
  state.players[owner].scene = [
    sceneChar(card.id, 'source'),
    sceneChar(ACTOR.id, 'actor', { state: 'sleep' }),
    sceneChar(ACTIVE_DECOY.id, 'active-decoy'),
  ];
  state.players[owner].hand = [CUTIN.id, DISGUISE.id];
  state.players[opponent].scene = [
    sceneChar(TARGET.id, 'target'),
    sceneChar(PROTECTED.id, 'protected'),
  ];
  state.players[opponent].hand = [CUTIN.id, DISGUISE.id];
  return state;
}

function declare(): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
  });
}

function pendingPick() {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof pendingPick>>, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
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
    'action:declare': 0, 'action:guard-window': 0, 'action:guarded': 0,
    'action:unguarded': 0, 'contact:start': 0, 'contact:end': 0, 'action:end': 0,
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
  for (const card of [WHITE_PARTNER, ACTOR, ACTIVE_DECOY, TARGET, PROTECTED, CUTIN, DISGUISE]) {
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

describe('official QA Wave133: two public picks start a normal effect contact', () => {
  it.each(CASES)('$card.id owner $owner enforces both pick authorities and contact semantics', ({ card, owner }) => {
    const opponent = other(owner);
    install(base(card, owner), owner, `${card.id}-${owner}-contact`);
    const hooks = hookCounts();
    expect([B10036.id, B10036P.id]).toContain(card.id);

    expect(declare()).toEqual({ ok: true });
    const targetPick = pendingPick();
    expect(targetPick).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'bindPick',
      source: { uid: 'source', cardId: card.id, abilityId: 'a2' },
    });
    expect(targetPick.candidates.map(candidate => candidate.uid)).toEqual(['target']);
    choose(targetPick, 'target');

    const actorPick = pendingPick();
    expect(actorPick).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'bindPick',
      source: { uid: 'source', cardId: card.id, abilityId: 'a2' },
    });
    expect(actorPick.candidates.map(candidate => candidate.uid)).toEqual(['actor']);
    choose(actorPick, 'actor');

    const actionId = useGameStateStore.getState().activeActionId!;
    const action = actionContext(actionId);
    expect(action).toMatchObject({
      byUid: 'actor', generatedByEffect: true, phase: 'action-1',
      target: { kind: 'char', uid: 'target' },
    });
    expect(current().players[owner].scene.find(character => character.uid === 'source')?.state)
      .toBe('sleep');
    expect(current().players[owner].scene.find(character => character.uid === 'actor')).toMatchObject({
      state: 'sleep', turnEffects: expect.not.objectContaining({ actedCharThisTurn: true }),
    });
    expect(current().players[opponent].scene.find(character => character.uid === 'target')?.state)
      .toBe('active');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'protected' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(canCutIn(current(), action, owner, CUTIN.id)).toBe(true);
    expect(canCutIn(current(), action, opponent, CUTIN.id)).toBe(true);
    expect(canDisguise(current(), action, owner, DISGUISE.id)).toBe(true);
    expect(canDisguise(current(), action, opponent, DISGUISE.id)).toBe(true);

    finishContact(actionId);
    expect(hooks).toEqual({
      'action:declare': 0, 'action:guard-window': 0, 'action:guarded': 0,
      'action:unguarded': 0, 'contact:start': 1, 'contact:end': 1, 'action:end': 0,
    });
  });

  it.each(CASES)('$card.id owner $owner allows either up-to-one pick to decline', ({ card, owner }) => {
    install(base(card, owner), owner, `${card.id}-${owner}-decline-target`);
    expect(declare()).toEqual({ ok: true });
    choose(pendingPick(), null);
    const actorAfterTargetDecline = pendingPick();
    expect(actorAfterTargetDecline.candidates.map(candidate => candidate.uid)).toEqual(['actor']);
    choose(actorAfterTargetDecline, 'actor');
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    install(base(card, owner), owner, `${card.id}-${owner}-decline-actor`);
    expect(declare()).toEqual({ ok: true });
    choose(pendingPick(), 'target');
    choose(pendingPick(), null);
    expect(useGameStateStore.getState().activeActionId).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
