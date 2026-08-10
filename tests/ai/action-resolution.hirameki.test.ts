import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerAll } from '@/cards';
import { resolveActionAgainstCase } from '@/ai/action-resolution';
import type { Move } from '@/ai/move-enumerator';
import type { AIPolicy } from '@/ai/policy';
import { MCTSTreePolicy } from '@/ai/policies/mcts-tree';
import { MCTSPolicy } from '@/ai/policies/mcts';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { captureNondeterminism } from '@/ai/replay/nondeterminism';
import type { ReplayLog, ReplayLogV1 } from '@/ai/replay/recorder';
import { replayLog } from '@/ai/replay/player';
import { buildReplayLogV3 } from '@/ai/replay/state-frame';
import { _peekPendingHirameki, flow } from '@/engine';
import { hasPendingHumanPick } from '@/engine/effect/apply-pick';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import { pushPendingHirameki } from '@/engine/listeners/hirameki';
import { startCausalSession } from '@/engine/log/causal';
import { produce } from '@/engine/produce';
import { register as registerCardDef } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';
import {
  createHiramekiDemoState,
  HIRAMEKI_DEMO_OPP_ATTACKER_UID,
} from '@/ui/fixtures/hiramekiDemoState';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { computeStateAt } from '@/ui/hooks/useReplayDriver';
import { useGameStateStore } from '@/ui/state/store';

const ACTION_MOVE: Move = {
  kind: 'actionAgainstCase',
  byUid: HIRAMEKI_DEMO_OPP_ATTACKER_UID,
  targetPlayer: 'self',
};

function passPolicy(name: string): AIPolicy {
  return {
    name,
    choose: () => null,
    chooseGuard: () => null,
  };
}

function hiramekiPolicy(choice: boolean) {
  const chooseHiramekiTrigger = vi.fn(() => choice);
  const policy: AIPolicy = {
    ...passPolicy(`hirameki-${choice ? 'fire' : 'skip'}`),
    chooseHiramekiTrigger,
    chooseAtomTarget: (_state, _verb, _args, candidates) =>
      candidates.find((candidate) => candidate.uid === 'demo-opp-3') ?? candidates[0] ?? null,
  };
  return { policy, chooseHiramekiTrigger };
}

const YAIBA_CASE: CardDef = {
  id: 'TEST-CASE-YAIBA',
  no: 'test/TEST-CASE-YAIBA',
  kind: 'case',
  names: ['TEST-CASE-YAIBA'],
  colors: ['緑'],
  traits: [],
  caseLevel: 6,
  caseTraits: ['YAIBA'],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

function runBundledHirameki(
  cardId: string,
  choice: boolean,
  configure?: (state: GameState) => void,
) {
  const initial = createHiramekiDemoState(cardId);
  configure?.(initial);
  startCausalSession(initial, `ai-hirameki-${cardId}-${choice ? 'fire' : 'skip'}`);
  const defender = hiramekiPolicy(choice);
  const state = produce(initial, (draft) => {
    resolveActionAgainstCase(
      draft,
      HIRAMEKI_DEMO_OPP_ATTACKER_UID,
      'self',
      defender.policy,
      passPolicy('attacker'),
    );
  });
  return { initial, state, defender };
}

function expectClosedCheckpoint(state: GameState): void {
  expect(_peekPendingHirameki()).toBeNull();
  expect(hasPendingHumanPick(state)).toBe(false);
  expect(state.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
  expect(state.pendingRuntimeState).toBeUndefined();
  expect(Object.keys(state.actionContexts ?? {})).toHaveLength(0);
}

function hiramekiReplayV1(): ReplayLogV1 {
  const initialState = createHiramekiDemoState('D11009');
  return {
    schemaVersion: 1,
    initialState,
    moves: [
      { turn: 1, player: 'opp', move: ACTION_MOVE },
      { turn: 1, player: 'opp', move: { kind: 'endTurn' } },
    ],
    result: { winner: 'draw', reason: 'turn-cap', turns: 2 },
  };
}

function hiramekiReplay(schemaVersion: 1 | 2): ReplayLog {
  const v1 = hiramekiReplayV1();
  if (schemaVersion === 1) return v1;
  const { trace } = captureNondeterminism(() => replayLog(v1));
  return { ...v1, schemaVersion: 2, nondeterminism: trace };
}

describe('resolveActionAgainstCase Hirameki checkpoint', () => {
  beforeAll(() => {
    registerAll();
    registerCardDef(YAIBA_CASE);
  });

  afterEach(() => {
    flow.action._resetActionContexts();
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
  });

  it.each([
    ['MCTSPolicy', () => new MCTSPolicy({ rollouts: 1, rolloutMaxTurns: 1 })],
    ['MCTSTreePolicy', () => new MCTSTreePolicy({ iterations: 1, rolloutMaxTurns: 1 })],
  ] as const)('%s restores the caller pending runtime after candidate simulation', (_label, createPolicy) => {
    const state = createHiramekiDemoState('D11009');
    startCausalSession(state, `mcts-runtime-${_label}`);
    const callerPending = { player: 'self' as const, cardId: 'LIVE', abilityId: 'a1' };
    pushPendingHirameki(callerPending);

    createPolicy().choose(state, [ACTION_MOVE, { kind: 'endTurn' }], 'opp');

    expect(_peekPendingHirameki()).toEqual(callerPending);
  });

  it('hydrates each rollout before MCTSPolicy evaluates a sibling candidate', () => {
    const state = createHiramekiDemoState('D11009');
    startCausalSession(state, 'mcts-rollout-inner-authority');
    const callerPending = { player: 'self' as const, cardId: 'LIVE', abilityId: 'a1' };
    pushPendingHirameki(callerPending);
    const observed: Array<string | null> = [];
    const triggerSpy = vi.spyOn(HeuristicPolicy.prototype, 'chooseHiramekiTrigger')
      .mockImplementation((_state, pending) => {
        observed.push(pending.cardId ?? null);
        return false;
      });
    const policy = new MCTSPolicy({ rollouts: 1, rolloutMaxTurns: 1 }) as unknown as {
      simulate: (input: GameState, move: Move, player: 'self' | 'opp', index: number) => number;
    };

    try {
      policy.simulate(state, ACTION_MOVE, 'opp', 0);
      policy.simulate(state, ACTION_MOVE, 'opp', 1);

      expect(observed).toEqual(['D11009', 'D11009']);
      expect(_peekPendingHirameki()).toEqual(callerPending);
    } finally {
      triggerSpy.mockRestore();
    }
  });

  it('hydrates the selected child state before MCTSTreePolicy expands below the root', () => {
    const childState = createHiramekiDemoState('D11009');
    startCausalSession(childState, 'mcts-tree-child-authority');
    const rootState = createHiramekiDemoState('D11009');
    startCausalSession(rootState, 'mcts-tree-root-authority');
    const rootPending = { player: 'self' as const, cardId: 'ROOT', abilityId: 'a1' };
    pushPendingHirameki(rootPending);
    persistPendingRuntimeState(rootState);

    type TestNode = {
      state: GameState;
      parent: TestNode | null;
      moveFromParent: Move | null;
      toMove: 'self' | 'opp';
      visits: number;
      totalScore: number;
      children: TestNode[];
      untriedMoves: Move[];
    };
    const root = {
      state: rootState,
      parent: null,
      moveFromParent: null,
      toMove: 'opp' as const,
      visits: 1,
      totalScore: 0,
      children: [] as TestNode[],
      untriedMoves: [] as Move[],
    } satisfies TestNode;
    const selectedChild = {
      state: childState,
      parent: root,
      moveFromParent: { kind: 'endTurn' } as Move,
      toMove: 'opp' as const,
      visits: 0,
      totalScore: 0,
      children: [] as TestNode[],
      untriedMoves: [ACTION_MOVE],
    } satisfies TestNode;
    root.children.push(selectedChild);
    const policy = new MCTSTreePolicy({ iterations: 1, rolloutMaxTurns: 1 }) as unknown as {
      runIteration: (node: TestNode, player: 'self' | 'opp', index: number) => void;
    };

    policy.runIteration(root, 'opp', 0);

    expect(selectedChild.children).toHaveLength(1);
    expect(_peekPendingHirameki()).toEqual(rootPending);
  });

  it('hydrates the rollout leaf while MCTSTreePolicy delegates to runMatch', () => {
    const leafState = createHiramekiDemoState('D11009');
    startCausalSession(leafState, 'mcts-tree-rollout-leaf');
    const leafPending = { player: 'self' as const, cardId: 'CHILD', abilityId: 'a1' };
    pushPendingHirameki(leafPending);
    persistPendingRuntimeState(leafState);
    resetPendingRuntimeState();
    const callerPending = { player: 'self' as const, cardId: 'ROOT', abilityId: 'a1' };
    pushPendingHirameki(callerPending);
    const observed: Array<string | null> = [];
    const chooseSpy = vi.spyOn(HeuristicPolicy.prototype, 'choose')
      .mockImplementation((_state, candidates) => {
        observed.push(_peekPendingHirameki()?.cardId ?? null);
        return candidates.find((candidate) => candidate.kind === 'endTurn') ?? null;
      });
    const leaf = {
      state: leafState,
      parent: null,
      moveFromParent: null,
      toMove: 'opp' as const,
      visits: 0,
      totalScore: 0,
      children: [],
      untriedMoves: [],
    };
    const policy = new MCTSTreePolicy({ iterations: 1, rolloutMaxTurns: 1 }) as unknown as {
      simulate: (node: typeof leaf, player: 'self' | 'opp', index: number) => number;
    };

    try {
      policy.simulate(leaf, 'opp', 0);

      expect(observed).toEqual(['CHILD']);
      expect(_peekPendingHirameki()).toEqual(callerPending);
    } finally {
      chooseSpy.mockRestore();
    }
  });

  it.each([
    ['MCTSPolicy', () => new MCTSPolicy({ rollouts: 2, rolloutMaxTurns: 1 })],
    ['MCTSTreePolicy', () => new MCTSTreePolicy({ iterations: 2, rolloutMaxTurns: 1 })],
  ] as const)('%s isolates sibling simulations inside the headless search', (_label, createPolicy) => {
    const state = createHiramekiDemoState('D11009');
    startCausalSession(state, `mcts-sibling-runtime-${_label}`);
    const callerPending = { player: 'self' as const, cardId: 'LIVE', abilityId: 'a1' };
    pushPendingHirameki(callerPending);
    const policy = createPolicy() as unknown as {
      chooseHeadless: (input: GameState, moves: Move[], player: 'self' | 'opp') => Move | null;
    };

    policy.chooseHeadless(state, [ACTION_MOVE, { kind: 'endTurn' }], 'opp');

    expect(_peekPendingHirameki()).toEqual(callerPending);
  });

  it.each([
    { label: 'fire', choice: true, expectedTargetState: 'sleep' },
    { label: 'skip', choice: false, expectedTargetState: 'active' },
  ] as const)(
    'consumes real D11009, resolves nested target choice, and closes the action ($label)',
    ({ choice, expectedTargetState }) => {
      const { state, defender } = runBundledHirameki('D11009', choice);

      expect(defender.chooseHiramekiTrigger).toHaveBeenCalledTimes(1);
      expect(state.players.self.evidence).toHaveLength(0);
      expect(state.players.self.remove).toEqual(['D11009']);
      expect(state.players.opp.evidence).toHaveLength(1);
      expect(state.players.opp.scene.find((card) => card.uid === 'demo-opp-3')?.state)
        .toBe(expectedTargetState);
      expectClosedCheckpoint(state);
    },
  );

  it.each(['B02088', 'B03126'] as const)(
    '%s fire suppresses the attacker evidence gain before cleanup',
    (cardId) => {
      const { state, defender } = runBundledHirameki(cardId, true);

      expect(defender.chooseHiramekiTrigger).toHaveBeenCalledTimes(1);
      expect(state.players.opp.evidence).toHaveLength(0);
      expect(state.log.filter((entry) => entry.schemaVersion === 1 && entry.kind === 'evidence'))
        .toHaveLength(0);
      expect(state.turnState.opp.evidenceGainSuppressed).toBe(false);
      expectClosedCheckpoint(state);
    },
  );

  it.each(['B02088', 'B03126'] as const)(
    '%s skip preserves exactly one attacker evidence gain',
    (cardId) => {
      const { state, defender } = runBundledHirameki(cardId, false);

      expect(defender.chooseHiramekiTrigger).toHaveBeenCalledTimes(1);
      expect(state.players.opp.evidence).toHaveLength(1);
      expect(state.log.filter((entry) => entry.schemaVersion === 1 && entry.kind === 'evidence'))
        .toHaveLength(1);
      expect(state.turnState.opp.evidenceGainSuppressed).not.toBe(true);
      expectClosedCheckpoint(state);
    },
  );

  it('completes real B06035 optional cost and nested target pick headlessly', () => {
    const { state, defender } = runBundledHirameki('B06035', true, (draft) => {
      draft.players.self.case.cardId = YAIBA_CASE.id;
      draft.players.self.case.status = '解決編';
      draft.players.self.hand = ['D11008'];
    });

    expect(defender.chooseHiramekiTrigger).toHaveBeenCalledTimes(1);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(expect.arrayContaining(['B06035', 'D11008']));
    expect(state.players.opp.scene.some((card) => card.uid === 'demo-opp-3')).toBe(false);
    expect(state.players.opp.remove).toContain('D08019');
    expect(state.players.opp.evidence).toHaveLength(1);
    expectClosedCheckpoint(state);
  });

  it.each([1, 2] as const)(
    'legacy replay V%s renders a completed D11009 checkpoint',
    (schemaVersion) => {
      const replay = hiramekiReplay(schemaVersion);
      expect(replay.initialState.causalLog).toBeUndefined();
      const state = computeStateAt(replay, 1);

      expect(state.players.self.remove).toEqual(['D11009']);
      expect(state.players.opp.evidence).toHaveLength(1);
      expect(state.players.opp.scene.filter((card) => card.state === 'sleep')).toHaveLength(3);
      expectClosedCheckpoint(state);
      expect(replay.initialState.causalLog).toBeUndefined();
      expect(replayLog(replay)).toMatchObject({
        winner: 'draw',
        reason: 'turn-cap',
        turns: 2,
      });
    },
  );

  it.each([true, false])(
    'keeps deferred evidence deck-out as the sole terminal causal event (fire=%s)',
    (choice) => {
      const { initial, state } = runBundledHirameki('D11009', choice, (draft) => {
        draft.players.opp.deck = [];
        draft.players.opp.remove = [];
      });
      const causal = state.log.filter((entry) => entry.schemaVersion === 1);

      expect(state.gameResult).toEqual({ winner: 'self', reason: 'deck-out' });
      expect(causal.filter((entry) => entry.kind === 'game-result')).toHaveLength(1);
      expect(causal.at(-1)?.kind).toBe('game-result');
      expect(() => buildReplayLogV3({
        artifactId: `deferred-evidence-deck-out-${choice ? 'fire' : 'skip'}`,
        sessionId: state.causalLog!.sessionId,
        viewerMode: 'spectator',
        states: [initial, state],
      })).not.toThrow();
    },
  );

  it('restores strict Hirameki checkpoint admission after legacy playback', () => {
    replayLog(hiramekiReplayV1());
    const initial = createHiramekiDemoState('D11009');
    useGameStateStore.setState({ gameState: initial });
    useGameStateStore.getState().setPendingHirameki({
      player: 'self',
      cardId: 'D11009',
      abilityId: 'a1',
    });
    const pending = useGameStateStore.getState().pendingHirameki!;
    const before = structuredClone(initial);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'hiramekiResolve',
      choice: 'fire',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingHirameki).toEqual(pending);
    expect(useGameStateStore.getState().gameState).toEqual(before);

    expect(() => produce(initial, (draft) => {
      resolveActionAgainstCase(
        draft,
        HIRAMEKI_DEMO_OPP_ATTACKER_UID,
        'self',
        hiramekiPolicy(true).policy,
        passPolicy('attacker'),
      );
    })).toThrow('Hirameki checkpoint does not match active action');
  });

  it('MCTS tree expansion consumes D11009 before evaluating the child state', () => {
    const initialState = createHiramekiDemoState('D11009');
    startCausalSession(initialState, 'mcts-tree-hirameki');
    let evaluated: GameState | undefined;
    const policy = new MCTSTreePolicy({
      iterations: 1,
      rolloutMaxTurns: 1,
      evaluator: (state) => {
        evaluated = state;
        return 0;
      },
    });

    const selected = policy.choose(initialState, [ACTION_MOVE, { kind: 'endTurn' }], 'opp');

    expect(selected).toEqual(ACTION_MOVE);
    expect(evaluated).toBeDefined();
    expectClosedCheckpoint(evaluated!);
  });
});
