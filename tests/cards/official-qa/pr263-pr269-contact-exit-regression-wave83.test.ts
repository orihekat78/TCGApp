// Horizontal regression: a disguise rider removes the non-current contact participant.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { _runDriverStep } from '@/ui/hooks/useContactFlowDriver';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const OLD_FACE = 'W83-PR-OLD';
const TARGET = 'W83-PR-TARGET';
const JEWEL = 'W83-PR-JEWEL';
const FILE_CARD = 'W83-PR-FILE';
const ACTOR_UID = 'wave83-pr-actor';
const TARGET_UID = 'wave83-pr-target';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing PR263/PR269 contact-exit state');
  return state;
}

function stateFor(cardId: 'PR263' | 'PR269'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 34, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.file = Array.from({ length: 7 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD,
  }));
  state.players.self.hand = [cardId];
  state.players.self.partnerAreaCards = [JEWEL];
  state.players.self.scene = [sceneChar(OLD_FACE, ACTOR_UID, { state: 'active' })];
  state.players.opp.scene = [sceneChar(TARGET, TARGET_UID, { state: 'sleep' })];
  return state;
}

function install(cardId: 'PR263' | 'PR269'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  expect(useGameStateStore.getState().setGameState(stateFor(cardId))).toBe(true);
}

function reachFirstWindow(): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: ACTOR_UID, targetUid: TARGET_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('PR contact ended before action-1');
    if (context.phase === 'action-1') {
      expect(context.firstUid).toBe(ACTOR_UID);
      expect(context.secondUid).toBe(TARGET_UID);
      return actionId;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('PR action-1 not reached');
}

function openOptional(cardId: 'PR263' | 'PR269'): string {
  const actionId = reachFirstWindow();
  expect(dispatchEngineAction({
    type: 'actionContact', actionId, player: 'self', choice: { kind: 'disguise', cardId },
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  expect(useGameStateStore.getState().pendingEffectOptional?.source)
    .toMatchObject({ cardId, abilityId: 'a3' });
  return actionId;
}

function acceptAndRemoveTarget(actionId: string): void {
  const optional = useGameStateStore.getState().pendingEffectOptional!;
  expect(dispatchEngineAction(bindPendingDecision(optional, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });

  const jewelPick = useGameStateStore.getState().pendingEffectPick!;
  expect(jewelPick).toMatchObject({ atomVerb: 'partnerAreaRemove', player: 'self' });
  expect(jewelPick.candidates.map(candidate => candidate.cardId)).toEqual([JEWEL]);
  expect(dispatchEngineAction(bindPendingDecision(jewelPick, {
    type: 'effectPickResolve', pickedUid: jewelPick.candidates[0]!.uid,
  }))).toEqual({ ok: true });

  const scenePick = useGameStateStore.getState().pendingEffectPick!;
  expect(scenePick).toMatchObject({ atomVerb: 'sceneRemove', player: 'self', nMin: 0, nMax: 1 });
  expect(scenePick.candidates.some(candidate => candidate.uid === TARGET_UID)).toBe(true);
  expect(dispatchEngineAction(bindPendingDecision(scenePick, {
    type: 'effectPickResolve', pickedUid: TARGET_UID,
  }))).toEqual({ ok: true });
  expect(current().players.self.scene.some(card => card.uid === ACTOR_UID)).toBe(true);
  expect(current().players.opp.scene.some(card => card.uid === TARGET_UID)).toBe(false);
  expect(flow.action._getContext(current(), actionId)).toMatchObject({
    phase: 'action-1', firstActed: true,
  });
}

function resumeDriver(actionId: string): void {
  const context = flow.action._getContext(current(), actionId)!;
  _runDriverStep(current(), context);
  expect(flow.action._getContext(current(), actionId)?.phase).toBe('contact-end');
  expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(flow.action._getContext(current(), actionId)).toBeUndefined();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixture(OLD_FACE, { ap: 1000 }));
  register(fixture(TARGET, { colors: ['赤'], level: 7, ap: 9000 }));
  register(fixture(JEWEL, { traits: ['ビッグジュエル'] }));
  register(fixture(FILE_CARD));
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('PR263/PR269 contact participant exit regression', () => {
  it.each(['PR263', 'PR269'] as const)(
    '%s removes the non-current participant and the public driver closes contact',
    cardId => {
      install(cardId);
      const actionId = openOptional(cardId);
      acceptAndRemoveTarget(actionId);
      resumeDriver(actionId);
    },
  );

  it('PR269 preserves the same terminal path after optional save hydration', () => {
    install('PR269');
    const actionId = openOptional('PR269');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    const stale = useGameStateStore.getState().pendingEffectOptional!;

    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional?.decisionId).not.toBe(stale.decisionId);

    acceptAndRemoveTarget(actionId);
    resumeDriver(actionId);
  });
});
