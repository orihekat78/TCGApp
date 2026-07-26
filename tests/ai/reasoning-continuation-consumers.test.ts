import { beforeEach, describe, expect, it } from 'vitest';
import { MCTSPolicy } from '@/ai/policies/mcts';
import { MCTSTreePolicy } from '@/ai/policies/mcts-tree';
import type { Move } from '@/ai/move-enumerator';
import type { ReplayLog } from '@/ai/replay/recorder';
import { computeStateAt } from '@/ui/hooks/useReplayDriver';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';

const REASONER: CardDef = {
  id: 'CONSUMER_REASONER', no: 'CONSUMER_REASONER', kind: 'character',
  names: ['Consumer reasoner'], colors: ['blue'], level: 1, ap: 1000, lp: 1,
  traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const OBSERVER: CardDef = {
  id: 'CONSUMER_OBSERVER', no: 'CONSUMER_OBSERVER', kind: 'character',
  names: ['Reasoning end observer'], colors: ['blue'], level: 1, ap: 1000, lp: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'draw-after-reasoning', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'reasoning:end', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: 'Consumer reasoner' } } },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'draw after own reasoning', ruleRefs: [],
  }],
};

const reasoningMove: Move = { kind: 'reasoning', uid: 'reasoner#1' };

function stateWithReasoning(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    mutate.scene.enter(draft, 'self', REASONER.id, {}).uid = 'reasoner#1';
    mutate.scene.enter(draft, 'self', OBSERVER.id, {}).uid = 'observer#1';
    draft.players.self.deck = ['evidence', 'draw', 'reserve'];
  });
}

function expectCompletedReasoning(state: GameState): void {
  expect(state.players.self.evidence).toHaveLength(1);
  expect(state.players.self.hand).toEqual(['draw']);
  expect(state.log.filter((entry) => entry.action === 'reasoning').at(-1)?.result).toBe('evidence+1');
  expect(state.pendingReasoningContinuation).toBeUndefined();
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerCardDef(REASONER);
  registerCardDef(OBSERVER);
  registerTriggeredListener();
});

describe('reasoning continuation consumers', () => {
  it('MCTS rollout drains reasoning and its reasoning:end trigger before evaluation', () => {
    let evaluated: GameState | undefined;
    const policy = new MCTSPolicy({
      rollouts: 1,
      evaluationTurns: 1,
      evaluator: (state) => { evaluated = state; return 0; },
    });

    (policy as unknown as { simulate: (state: GameState, move: Move, player: 'self', index: number) => number })
      .simulate(stateWithReasoning(), reasoningMove, 'self', 0);

    expectCompletedReasoning(evaluated!);
  });

  it('MCTS tree expansion/next selection drains reasoning before rollout', () => {
    let evaluated: GameState | undefined;
    const policy = new MCTSTreePolicy({
      iterations: 1,
      rolloutMaxTurns: 1,
      evaluator: (state) => { evaluated = state; return 0; },
    });

    const selected = policy.choose(stateWithReasoning(), [reasoningMove, { kind: 'endTurn' }], 'self');

    expect(selected).toEqual(reasoningMove);
    expectCompletedReasoning(evaluated!);
  });

  it('replay computeStateAt drains reasoning before rendering the move state', () => {
    const log: ReplayLog = {
      schemaVersion: 1,
      initialState: stateWithReasoning(),
      moves: [{ turn: 2, player: 'self', move: reasoningMove }],
      result: { winner: 'draw', reason: 'turn-cap', turns: 2 },
    };

    expectCompletedReasoning(computeStateAt(log, 1));
  });
});
