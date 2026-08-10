import { describe, expect, it } from 'vitest';
import { runOne } from '@/engine/resolve/stack';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CausalLogEntryV1, GameState } from '@/engine/types';

function runCausalSceneEnter(setup?: (state: GameState) => void): GameState {
  const state = createEmptyGameState();
  setup?.(state);
  startCausalSession(state, 'partner-area-source');
  return produce(state, (draft) => {
    runOne(draft, {
      id: 'partner-area-source-entry',
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: 'PRIVATE-PARTNER-CARD',
          sourceRequired: true,
          target: { query: { area: ['partner-area', 'remove'], side: 'opp' } },
        },
      },
      state: 'pending',
    });
  });
}

describe('causal partner-area source moves', () => {
  it('publishes the actual partner-area move without exposing its hidden ability source', () => {
    const state = runCausalSceneEnter((draft) => {
      draft.players.opp.partnerAreaCards = ['PRIVATE-PARTNER-CARD'];
      draft.players.opp.remove = ['PRIVATE-PARTNER-CARD'];
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['zone-move', { type: 'move', from: 'partner', to: 'scene', count: 1 }],
      ['enter', { type: 'state', state: 'success' }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
    expect(graph[1]).toMatchObject({
      actor: 'self',
      source: { kind: 'zone', side: 'opp', zone: 'partner' },
      targets: [{ kind: 'zone', side: 'self', zone: 'scene' }],
    });
    expect(graph[2]).toMatchObject({
      kind: 'enter',
      targets: [{ kind: 'card', side: 'self', zone: 'scene', cardNumber: 'PRIVATE-PARTNER-CARD' }],
    });
    expect(state.players.opp.partnerAreaCards).toEqual([]);
    expect(state.players.opp.remove).toEqual(['PRIVATE-PARTNER-CARD']);
    expect(JSON.stringify(state.log)).toContain('PRIVATE-PARTNER-CARD');
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-SOURCE');
  });

  it('does not invent a move when the partner-area source is absent', () => {
    const state = runCausalSceneEnter();

    expect(validateCausalLog(state.log as CausalLogEntryV1[]).map((node) => node.kind))
      .toEqual(['declare', 'summary']);
    expect(state.players.self.scene).toEqual([]);
  });
});
