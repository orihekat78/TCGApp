import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';

function runCausalSceneEnter(
  sessionId: string,
  setup: (state: GameState) => void,
  args: Record<string, unknown> = {
    player: 'self',
    cardId: 'D08001',
    target: { query: { area: 'deck', side: 'self' } },
  },
): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);

  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: { player: 'self', cardId: 'PRIVATE-SOURCE', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'atom',
        verb: 'sceneEnter',
        args,
      },
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

describe('sceneEnter deck-source causal refresh projection', () => {
  it('records an initial empty-deck refresh before the deck-to-scene move', () => {
    const state = runCausalSceneEnter('scene-enter-initial-refresh', (draft) => {
      draft.players.self.remove = ['D08001', 'PRIVATE-OTHER'];
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'scene-enter-initial-refresh:1', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['zone-move', 'scene-enter-initial-refresh:2', undefined, { type: 'move', from: 'deck', to: 'scene', count: 1 }],
      ['enter', 'scene-enter-initial-refresh:3', undefined, { type: 'state', state: 'success' }],
      ['summary', 'scene-enter-initial-refresh:4', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(state.players.self.scene.map((card) => card.cardId)).toEqual(['D08001']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records the deck-to-scene move before the refresh after exact final-card exhaustion', () => {
    const state = runCausalSceneEnter('scene-enter-final-refresh', (draft) => {
      draft.players.self.deck = ['D08001'];
      draft.players.self.remove = ['PRIVATE-REFRESH'];
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId, node.tags, node.outcome])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'scene-enter-final-refresh:1', undefined, { type: 'move', from: 'deck', to: 'scene', count: 1 }],
      ['enter', 'scene-enter-final-refresh:2', undefined, { type: 'state', state: 'success' }],
      ['zone-move', 'scene-enter-final-refresh:3', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 1 }],
      ['summary', 'scene-enter-final-refresh:4', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('ends in deck-out without inventing a deck-to-scene or refresh operation', () => {
    const state = runCausalSceneEnter('scene-enter-deck-out', () => {});

    expect(state.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['game-result', { type: 'state', state: 'success' }],
    ]);
  });

  it('records each multi-card transfer before its matching public enter node', () => {
    const state = runCausalSceneEnter('scene-enter-multi', (draft) => {
      draft.players.self.deck = ['D08001', 'D08002', 'PRIVATE-KEEP'];
    }, {
      player: 'self',
      cardIds: ['D08001', 'D08002'],
      selectedDeckIndexes: [0, 1],
      target: { query: { area: 'deck', side: 'self' } },
    });

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'scene-enter-multi:1', { type: 'move', from: 'deck', to: 'scene', count: 1 }],
      ['enter', 'scene-enter-multi:2', { type: 'state', state: 'success' }],
      ['zone-move', 'scene-enter-multi:3', { type: 'move', from: 'deck', to: 'scene', count: 1 }],
      ['enter', 'scene-enter-multi:4', { type: 'state', state: 'success' }],
      ['summary', 'scene-enter-multi:5', { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-KEEP');
  });
});
