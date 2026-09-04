// qa: card:B05007:64c8ea1dbd685ed1a2d1338e4c52910b1b19f6cca7249f8e288576f37e426d44
// qa: card:B05007:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B05007:1326a9294ee6a8f8fb160e25680fb9eadb1af57c1a38f516b058d52eecea0875
// qa: card:B05007:019c31932bddda5b453014f4ec4364977f67883a0f66e9aa02f1505c54beb126
// qa: card:B05007:03ab9e39864651b7fb215fb7b4390a0a90599aa1e6abaa6868353ceba72938cb
// qa: card:B05007:f81037b5ce4fb4b845801fc4299b7cb4b9aefbe1a4684435283484b25e5d416e
// qa: card:B05007:8e1da005d76183ea47967a03d6c18dd03568acc2047544ed69e2deb0ce4e7a24

import { produce } from 'immer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05007 } from '@/cards/ct-p05/B05007';
import { B05007P } from '@/cards/ct-p05/B05007P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { canCutIn, canDisguise } from '@/engine/flow/contact';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B05007, B05007P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const MOURI = fixture('W129_MOURI', { names: ['毛利小五郎'] });
const ACTOR = fixture('W129_ACTOR', { ap: 0, traits: ['毛利探偵事務所'] });
const TARGET = fixture('W129_TARGET', { ap: 1000 });
const COST = fixture('W129_COST', { kind: 'event', ap: undefined, lp: undefined });
const DRAW_1 = fixture('W129_DRAW_1', { kind: 'event', ap: undefined, lp: undefined });
const DRAW_2 = fixture('W129_DRAW_2', { kind: 'event', ap: undefined, lp: undefined });
const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave129 nested entry sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const ENTRY = fixture('W129_ENTRY', { names: ['工藤新一'], level: 6, abilities: [enterDraw] });
const CUTIN = fixture('W129_CUTIN', {
  kind: 'event', ap: undefined, lp: undefined,
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: 'Wave129 Cut-In sentinel.', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});
const DISGUISE = fixture('W129_DISGUISE', {
  abilities: [{
    id: 'disguise', type: 'icon-disguise',
    description: 'Wave129 disguise sentinel.', ruleRefs: ['rules/09-cutin-disguise.md'],
  }],
});

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
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
  if (!state) throw new Error('missing Wave129 state');
  return state;
}

function actionContext(actionId: string) {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave129 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave129-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolveOptional(run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function resolvePick(uid: string | null): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function openEntry(card: CardDef, owner: Player, deck: string[], label: string): string {
  const state = createEmptyGameState();
  state.turn = { number: 11, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['青'];
  state.players[owner].file = Array.from({ length: 7 }, () => ({
    type: 'card-back' as const, cardId: DRAW_1.id,
  }));
  state.players[owner].hand = [card.id, ENTRY.id];
  state.players[owner].deck = [...deck];
  install(state, owner, label);
  expect([B05007.id, B05007P.id]).toContain(card.id);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
    .toEqual({ ok: true });
  const source = current().players[owner].scene.find(character => character.cardId === card.id)!;
  expect(source).toBeTruthy();
  resolveOptional(true);
  return source.uid;
}

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 20 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = current().actionContexts?.[actionId];
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
  for (const card of [MOURI, ACTOR, TARGET, COST, DRAW_1, DRAW_2, ENTRY, CUTIN, DISGUISE]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave129: a1 permits zero entry and resolves a nested enter hook', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    let sourceUid = openEntry(card, owner, [DRAW_1.id], `${card.id}-${owner}-zero`);
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.cardId))
      .toContain(ENTRY.id);
    resolvePick(null);
    expect(current().players[owner].scene.find(character => character.uid === sourceUid)?.state)
      .toBe('sleep');
    expect(current().players[owner].scene.some(character => character.cardId === ENTRY.id)).toBe(false);
    expect(current().players[owner].hand).toEqual(expect.arrayContaining([ENTRY.id, DRAW_1.id]));

    sourceUid = openEntry(card, owner, [DRAW_1.id, DRAW_2.id], `${card.id}-${owner}-nested`);
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const entry = pending.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
    resolvePick(entry.uid);
    expect(current().players[owner].scene.find(character => character.uid === sourceUid)?.state)
      .toBe('sleep');
    expect(current().players[owner].scene.some(character => character.cardId === ENTRY.id)).toBe(true);
    expect(current().players[owner].hand).toEqual(expect.arrayContaining([DRAW_1.id, DRAW_2.id]));
    const nested = current().pendingEffects.filter(effect => (
      effect.source.cardId === ENTRY.id && effect.source.abilityId === enterDraw.id
    ));
    expect(nested).toHaveLength(1);
    expect(nested[0]?.state).toBe('resolved');
  });
});

describe('official QA Wave129: armed action Cut-In ban survives source leave and applies repeatedly', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 11, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(card.id, 'source'),
      sceneChar(MOURI.id, 'bond'),
    ];
    state.players[owner].hand = [COST.id];
    state.players[opponent].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];
    state.players[opponent].hand = [CUTIN.id, DISGUISE.id];
    install(state, owner, `${card.id}-${owner}-arm`);
    expect([B05007.id, B05007P.id]).toContain(card.id);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    expect(current().turnState[owner].actionCutinBanOppFilter)
      .toEqual({ trait: '毛利探偵事務所' });
    expect(current().players[owner].remove).toContain(COST.id);

    const afterArm = produce(current(), draft => {
      mutate.scene.removeToRemove(draft, 'source', 'effect');
      draft.players[owner].scene.push(
        sceneChar(ACTOR.id, 'actor-1'),
        sceneChar(ACTOR.id, 'actor-2'),
      );
    });
    expect(useGameStateStore.getState().setGameState(afterArm)).toBe(true);
    expect(current().players[owner].scene.some(character => character.uid === 'source')).toBe(false);

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'actor-1', targetUid: 'target',
    })).toEqual({ ok: true });
    let actionId = useGameStateStore.getState().activeActionId!;
    let action = actionContext(actionId);
    expect(action.phase).toBe('guard-window');
    expect(canCutIn(current(), action, opponent, CUTIN.id)).toBe(false);

    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    action = actionContext(actionId);
    expect(action.phase).toBe('action-1');
    expect(canDisguise(current(), action, opponent, DISGUISE.id)).toBe(true);
    finishCharacterAction(actionId);

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'actor-2', targetUid: 'target',
    })).toEqual({ ok: true });
    actionId = useGameStateStore.getState().activeActionId!;
    action = actionContext(actionId);
    expect(action.phase).toBe('guard-window');
    expect(canCutIn(current(), action, opponent, CUTIN.id)).toBe(false);
  });
});
