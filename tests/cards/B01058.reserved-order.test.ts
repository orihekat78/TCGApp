import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B01058 } from '@/cards/ct-p01/B01058';
import { event } from '@/engine/event';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _drainPendingEffectPickSide,
  _peekPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { mutate } from '@/engine/mutate';
import {
  _resetReservedEffectsRegistered,
  registerReservedEffectListener,
} from '@/engine/listeners/reserved-effects';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

function character(id: string, color: string): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: [color],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const WHITE = character('B01058_WHITE', '白');
const SELF_SLEEPER = character('B01058_SELF_SLEEPER', '赤');
const OPP_SLEEPER = character('B01058_OPP_SLEEPER', '赤');
const LATE_TARGET = character('B01058_LATE_TARGET', '赤');
const SLEEP_OBSERVER: CardDef = {
  ...character('B01058_SLEEP_OBSERVER', '赤'),
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'evidence:removed' },
    effect: {
      kind: 'atom',
      verb: 'sceneSetState',
      args: { uid: 'late-target', state: 'sleep' },
    },
    description: 'sleep the later B01058 candidate',
    ruleRefs: [],
  }],
};

function baseState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.evidence = [{
    cardId: 'B01058_EVIDENCE',
    faceUp: false,
    origin: { turn: 1, via: 'effect' },
  }];
  return state;
}

function armRealB01058(state: GameState): void {
  const ability = B01058.abilities!.find((entry) => entry.id === 'a1')!;
  runEffect(state, ability.effect as Effect, {
    source: { player: 'self', cardId: B01058.id, abilityId: 'a1', area: 'hand' },
    bindings: {},
  } as EffectCtx);
  runAllUntilEmpty(state);

  const grantPick = _drainPendingEffectPickSide();
  expect(grantPick?.atomVerb).toBe('charGrantKeyword');
  expect(grantPick?.candidates.map((candidate) => candidate.uid)).toEqual(['white']);
  applyPickAndContinuation(state, grantPick!, 'white');
  runAllUntilEmpty(state);
  expect(state.reservedEffects).toHaveLength(1);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  [B01058, WHITE, SELF_SLEEPER, OPP_SLEEPER, LATE_TARGET, SLEEP_OBSERVER].forEach(registerCardDef);
  registerTriggeredListener();
  registerReservedEffectListener();
});

describe('B01058 reserved target timing', () => {
  it('surfaces both players sleep characters and applies the human choice only', () => {
    let state = baseState();
    state.players.self.scene = [
      sceneChar(WHITE.id, 'white'),
      sceneChar(SELF_SLEEPER.id, 'self-sleep', { state: 'sleep' }),
    ];
    state.players.opp.scene = [sceneChar(OPP_SLEEPER.id, 'opp-sleep', { state: 'sleep' })];
    armRealB01058(state);

    state = produce(state, (draft) => {
      mutate.evidence.removeTop(draft, 'opp');
      runAllUntilEmpty(draft);
    });

    const targetPick = _peekPendingEffectPickSide();
    expect(targetPick?.atomVerb).toBe('sceneSetState');
    expect(new Set(targetPick?.candidates.map((candidate) => candidate.uid))).toEqual(
      new Set(['self-sleep', 'opp-sleep']),
    );
    const resolvedPick = _drainPendingEffectPickSide()!;
    state = produce(state, (draft) => {
      applyPickAndContinuation(draft, resolvedPick, 'opp-sleep');
      runAllUntilEmpty(draft);
    });

    expect(state.players.self.scene.find((card) => card.uid === 'self-sleep')!.state).toBe('sleep');
    expect(state.players.opp.scene.find((card) => card.uid === 'opp-sleep')!.state).toBe('stun');
    expect(state.reservedEffects).toHaveLength(0);
  });

  it('evaluates candidates after an earlier same-hook effect makes one sleep', () => {
    let state = baseState();
    state.players.self.scene = [
      sceneChar(WHITE.id, 'white'),
      sceneChar(SLEEP_OBSERVER.id, 'observer'),
      sceneChar(LATE_TARGET.id, 'late-target', { state: 'active' }),
    ];
    armRealB01058(state);

    state = produce(state, (draft) => {
      mutate.evidence.removeTop(draft, 'opp');
    });
    const group = pendingOwnerOrderGroup(state, 'self');
    expect(group).toHaveLength(2);
    expect(_peekPendingEffectPickSide()).toBeNull();
    state = produce(state, (draft) => {
      for (const entry of pendingOwnerOrderGroup(draft, 'self')) {
        entry.ownerChosenOrder = entry.source.cardId === SLEEP_OBSERVER.id ? 0 : 1;
        entry.ownerOrderConfirmed = true;
      }
      runAllUntilEmpty(draft);
    });

    const targetPick = _peekPendingEffectPickSide();
    expect(state.players.self.scene.find((card) => card.uid === 'late-target')!.state).toBe('sleep');
    expect(targetPick?.candidates.map((candidate) => candidate.uid)).toEqual(['late-target']);
  });
});
