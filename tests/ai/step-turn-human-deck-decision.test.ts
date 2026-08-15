// CPU move effects may open a human-owned deck decision. The same step must pause,
// surface the exact post-move snapshot, and prevent another CPU move until resolution.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { runAtom } from '@/engine/effect/atom-handlers';
import { event } from '@/engine/event';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { playTurn, stepTurn, type AIPolicy } from '@/ai/policy';
import type { Move } from '@/ai/move-enumerator';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { driveOppTurn, _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { useGameStateStore } from '@/ui/state/store';
import { _clearPendingEffectChoiceSide, _peekPendingEffectChoiceSide, pushPendingEffectChoiceSide, type PendingEffectChoiceSide } from '@/engine/effect/pending-state';
import { _clearPendingEffectPickQueue, _peekPendingEffectPickSide, _pushPendingEffectPickSideForTest, type PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { registerAll } from '@/cards';
import type { PendingDeckPlaceSide } from '@/engine/effect/atom-handlers/_shared';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';

type HumanSide = 'self' | 'opp' | null;
const g = globalThis as {
  __humanPlayerSide?: HumanSide;
  __pendingDeckReorderSide?: unknown;
  __pendingDeckPlaceSide?: PendingDeckPlaceSide | null;
};

class DeclaredOnly implements AIPolicy {
  readonly name = 'declared-only';
  choose(_state: GameState, candidates: Move[]): Move | null {
    return candidates.find(move => move.kind === 'declaredAbility') ?? null;
  }
}

function cpuReorderCard(): CardDef {
  return {
    id: 'CPU-REORDER',
    no: 'CPU-REORDER',
    kind: 'character',
    names: ['CPU-REORDER'],
    colors: ['green'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [{
      id: 'a1',
      type: 'declared',
      scope: 'on-scene',
      effect: {
        kind: 'custom',
        fn: (state, ctx) => {
          ctx.bindings['$humanWindow'] = ['H-A', 'H-B'].map((cardId, index) => {
            const authority = deckOccurrenceAuthority(state, 'self', index);
            if (!authority || authority.cardId !== cardId) {
              throw new Error(`missing deck occurrence authority for ${cardId} at ${index}`);
            }
            return authority;
          });
          // Source is opp, so relative opp is the human self player's deck.
          runAtom(state, 'deckToBottomBound', { player: 'opp', bindKey: '$humanWindow' }, ctx);
        },
      },
      description: 'test',
      ruleRefs: [],
    }],
    ruleRefs: [],
  } as CardDef;
}

function cpuChoiceCard(): CardDef {
  return {
    id: 'CPU-CHOICE',
    no: 'CPU-CHOICE',
    kind: 'character',
    names: ['CPU-CHOICE'],
    colors: ['green'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [{
      id: 'a1',
      type: 'declared',
      scope: 'on-scene',
      effect: {
        kind: 'choice',
        chooser: 'owner',
        options: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      },
      description: 'test',
      ruleRefs: [],
    }],
    ruleRefs: [],
  } as CardDef;
}

function reorderState(): GameState {
  const state = createEmptyGameState();
  state.turn.player = 'opp';
  state.turn.phase = 'main';
  state.players.self.deck = ['H-A', 'H-B', 'TAIL'];
  mutate.scene.enter(state, 'opp', 'CPU-REORDER', { active: true });
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetUidCounter();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetIsDriving();
  registerCardDef(cpuReorderCard());
  registerCardDef(cpuChoiceCard());
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  g.__humanPlayerSide = 'self';
  g.__pendingDeckReorderSide = null;
  g.__pendingDeckPlaceSide = null;
  const store = useGameStateStore.getState();
  store.setGameState(null);
  store.setPendingDeckReorder(null);
  store.setPendingDeckPlace(null);
  store.setPendingEffectPick(null);
  store.setPendingEffectChoice(null);
});

afterEach(() => {
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  g.__humanPlayerSide = null;
  g.__pendingDeckReorderSide = null;
  g.__pendingDeckPlaceSide = null;
  const store = useGameStateStore.getState();
  store.setGameState(null);
  store.setPendingDeckReorder(null);
  store.setPendingDeckPlace(null);
  store.setPendingEffectPick(null);
  store.setPendingEffectChoice(null);
});

describe('CPU pause for human-owned deck decisions', () => {
  it('resolves B09075 a2 for CPU without pausing its AP pick', () => {
    registerAll();
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    state.turn.phase = 'main';
    mutate.scene.enter(state, 'opp', 'B09075', { active: true });
    mutate.scene.enter(state, 'opp', 'D11017', { active: true });

    const step = stepTurn(state, new DeclaredOnly(), 'opp');

    expect(step.move).toMatchObject({ kind: 'declaredAbility', abilityId: 'a2' });
    expect(_peekPendingEffectPickSide()).toBeNull();
    expect(step.paused).toBeUndefined();
    expect(step.nextState.log.filter(entry => entry.action === 'effect:charModifyAP:awaiting-pick')).toHaveLength(1);
    expect(step.nextState.log.filter(entry => entry.action === 'effect:charModifyAP')).toHaveLength(1);
  });

  it('does not choose a CPU move while the human must order unresolved effects', () => {
    const state = reorderState();
    state.pendingEffects = ['human-a', 'human-b'].map((id, index) => ({
      id,
      source: { player: 'self' as const, cardId: 'B03006' },
      triggeredBy: { hook: 'action:declare' },
      triggeredAt: { turn: 3, phase: 'main', nano: index },
      effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
      state: 'pending' as const,
    }));
    let chooseCalls = 0;
    const policy: AIPolicy = {
      name: 'must-not-choose',
      choose: () => { chooseCalls += 1; return null; },
    };

    const step = stepTurn(state, policy, 'opp');

    expect(step).toMatchObject({ move: null, done: false, paused: { humanPick: true } });
    expect(step.nextState).toBe(state);
    expect(chooseCalls).toBe(0);

    useGameStateStore.getState().setGameState(state);
    driveOppTurn();
    expect(useGameStateStore.getState().gameState).toBe(state);
    expect(state.pendingEffects.map(entry => entry.state)).toEqual(['pending', 'pending']);
  });

  it('pauses in the same step that generates a reorder, surfaces its snapshot, and resumes without stale state', () => {
    const initial = reorderState();
    const policy = new DeclaredOnly();

    const step = stepTurn(initial, policy, 'opp');

    expect(step.move?.kind).toBe('declaredAbility');
    expect(step.paused).toEqual({ humanPick: true });
    expect(step.nextState.players.self.deck).toEqual(['H-A', 'H-B', 'TAIL']);

    const blockedNextStep = stepTurn(step.nextState, policy, 'opp');
    expect(blockedNextStep).toMatchObject({ move: null, paused: { humanPick: true } });

    useGameStateStore.getState().setGameState(step.nextState, { preserveRuntime: true });
    surfacePendingSideChannels();
    const surfaced = useGameStateStore.getState().pendingDeckReorder;
    expect(surfaced).toMatchObject({
      player: 'self',
      cardIds: ['H-A', 'H-B'],
      deckSnapshot: ['H-A', 'H-B', 'TAIL'],
    });

    const beforeBlockedDrive = useGameStateStore.getState().gameState;
    driveOppTurn();
    expect(useGameStateStore.getState().gameState).toBe(beforeBlockedDrive);

    const resolved = dispatchEngineAction(bindPendingDecision(surfaced!, { type: 'deckReorderResolve', order: ['H-B', 'H-A'] }));
    expect(resolved.ok).toBe(true);
    expect(useGameStateStore.getState().gameState?.players.self.deck).toEqual(['TAIL', 'H-B', 'H-A']);
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  });

  it('playTurn records an already executed move before returning the human pause', () => {
    const result = playTurn(reorderState(), new DeclaredOnly(), 'opp');

    expect(result.moves.map(move => move.kind)).toEqual(['declaredAbility']);
    expect(result.paused).toEqual({ humanPick: true });
  });

  it('CPU-owned choice is resolved before returning the step to the opponent driver', () => {
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    state.turn.phase = 'main';
    state.players.opp.deck = ['CPU-DRAW'];
    mutate.scene.enter(state, 'opp', 'CPU-CHOICE', { active: true });

    const step = stepTurn(state, new DeclaredOnly(), 'opp');

    expect(step.move?.kind).toBe('declaredAbility');
    expect(_peekPendingEffectChoiceSide()).toBeNull();
    expect(step.nextState.players.opp.hand).toContain('CPU-DRAW');
  });

  it('does not surface a CPU-owned effect pick into the human UI store', () => {
    const pending: PendingEffectPickSide = {
      player: 'opp',
      ownerPlayer: 'opp',
      candidates: [],
      atomVerb: 'charModifyAP',
      atomArgs: {},
      nMin: 0,
      nMax: 1,
      source: { player: 'opp', cardId: 'CPU-REORDER', abilityId: 'a1' },
    };
    _pushPendingEffectPickSideForTest(pending);

    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(_peekPendingEffectPickSide()).toMatchObject({ player: 'opp' });
  });

  it('does not surface a CPU-owned effect choice into the human UI store', () => {
    const pending: PendingEffectChoiceSide = {
      player: 'opp',
      source: { player: 'opp', cardId: 'CPU-CHOICE', abilityId: 'a1' },
      options: [{ index: 0, verb: 'draw', args: { player: 'self', n: 1 } }],
    };
    pushPendingEffectChoiceSide(pending);

    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(_peekPendingEffectChoiceSide()).toMatchObject({ player: 'opp' });
  });

  it('uses deckPlace ownerPlayer, not the target deck player, for the human pause gate', () => {
    const state = reorderState();
    state.players.opp.deck = ['X', 'Y'];
    g.__pendingDeckPlaceSide = {
      player: 'opp',
      ownerPlayer: 'self',
      cardIds: ['X', 'Y'],
      deckSnapshot: ['X', 'Y'],
      occurrences: [{ cardId: 'X', index: 0 }, { cardId: 'Y', index: 1 }],
      occurrenceWitness: cardOccurrenceWitness(state, 'opp', 'deck'),
      ctx: {
        source: { player: 'self', area: 'scene', cardId: 'TEST', abilityId: 'a1' },
        bindings: {},
      },
    };
    let chooseCalls = 0;
    const policy: AIPolicy = {
      name: 'must-not-choose',
      choose: () => { chooseCalls += 1; return null; },
    };

    const step = stepTurn(state, policy, 'opp');

    expect(step).toMatchObject({ move: null, paused: { humanPick: true } });
    expect(chooseCalls).toBe(0);
    useGameStateStore.getState().setGameState(step.nextState, { preserveRuntime: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingDeckPlace).toMatchObject({
      player: 'opp', ownerPlayer: 'self', cardIds: ['X', 'Y'],
    });
  });
});
