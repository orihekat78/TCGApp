import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

function runCausalAtom(sessionId: string, setup: (state: GameState) => void, effect: EffectStackEntry['effect']): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);
  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: { player: 'self', cardId: 'PRIVATE-SOURCE', uid: 'private-source', abilityId: 'a1', area: 'scene' },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect,
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

describe('set-card causal projection', () => {
  it('records deck to set-card before the trailing refresh without private identity', () => {
    const state = runCausalAtom('causal-set-card-trailing-refresh', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
      draft.players.self.deck = ['PRIVATE-SET-CARD'];
      draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
    }, { kind: 'atom', verb: 'charSetCard', args: { uid: 'host', player: 'self', fromDeckTop: true } });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'zone-move', 'zone-move', 'summary']);
    expect(graph[1]).toMatchObject({ source: { kind: 'zone', side: 'self', zone: 'deck' }, targets: [{ kind: 'zone', side: 'self', zone: 'set-card' }], outcome: { type: 'move', from: 'deck', to: 'set-card', count: 1 } });
    expect(graph[2]).toMatchObject({ tags: ['refresh'], source: { kind: 'zone', side: 'self', zone: 'remove' }, targets: [{ kind: 'zone', side: 'self', zone: 'deck' }], outcome: { type: 'move', from: 'remove', to: 'deck', count: 2 } });
    expect(state.players.self.scene[0].setCards).toHaveLength(1);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('records an initial refresh before deck to set-card', () => {
    const state = runCausalAtom('causal-set-card-initial-refresh', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
      draft.players.self.remove = ['PRIVATE-SET-CARD', 'PRIVATE-REFRESH-CARD'];
    }, { kind: 'atom', verb: 'charSetCard', args: { uid: 'host', player: 'self', fromDeckTop: true } });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'zone-move', 'zone-move', 'summary']);
    expect(graph[1]).toMatchObject({ tags: ['refresh'], outcome: { type: 'move', from: 'remove', to: 'deck', count: 2 } });
    expect(graph[2]).toMatchObject({ outcome: { type: 'move', from: 'deck', to: 'set-card', count: 1 } });
  });

  it('records each resolved source zone before selected cards become set cards', () => {
    const state = runCausalAtom('causal-set-card-selected-zones', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
      draft.players.self.remove = ['PRIVATE-REMOVE-CARD'];
      draft.players.self.hand = ['PRIVATE-HAND-CARD'];
      draft.players.self.deck = ['PRIVATE-DECK-CARD'];
    }, {
      kind: 'atom',
      verb: 'charSetCard',
      args: {
        uid: 'host',
        cardIds: ['PRIVATE-REMOVE-CARD', 'PRIVATE-HAND-CARD', 'PRIVATE-DECK-CARD'],
        target: { kind: 'pick', query: { area: ['remove', 'hand', 'deck'], side: 'self' } },
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual([
      'declare', 'zone-move', 'zone-move', 'zone-move', 'summary',
    ]);
    expect(graph.slice(1, 4).map((node) => node.outcome)).toEqual([
      { type: 'move', from: 'remove', to: 'set-card', count: 1 },
      { type: 'move', from: 'hand', to: 'set-card', count: 1 },
      { type: 'move', from: 'deck', to: 'set-card', count: 1 },
    ]);
    expect(state.players.self.scene[0].setCards).toHaveLength(3);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('records the source event moving itself from remove to set-card', () => {
    const state = runCausalAtom('causal-set-card-from-self', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
      draft.players.self.remove = ['PRIVATE-SOURCE'];
    }, {
      kind: 'atom',
      verb: 'charSetCard',
      args: { uid: 'host', player: 'self', fromSelf: true },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'zone-move', 'summary']);
    expect(graph[1]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'remove' },
      targets: [{ kind: 'zone', side: 'self', zone: 'set-card' }],
      outcome: { type: 'move', from: 'remove', to: 'set-card', count: 1 },
    });
    expect(state.players.self.scene[0].setCards).toHaveLength(1);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('does not create a selected set card when any source occurrence is stale', () => {
    const state = runCausalAtom('causal-set-card-stale-selection', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
      draft.players.self.remove = ['PRIVATE-PRESENT-CARD'];
    }, {
      kind: 'atom',
      verb: 'charSetCard',
      args: {
        uid: 'host',
        cardIds: ['PRIVATE-PRESENT-CARD', 'PRIVATE-MISSING-CARD'],
        target: { kind: 'pick', query: { area: ['remove', 'hand'], side: 'self' } },
      },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'summary']);
    expect(state.players.self.remove).toEqual(['PRIVATE-PRESENT-CARD']);
    expect(state.players.self.scene[0].setCards).toEqual([]);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('does not recreate the source event when it is no longer in remove', () => {
    const state = runCausalAtom('causal-set-card-stale-self', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host')];
    }, {
      kind: 'atom',
      verb: 'charSetCard',
      args: { uid: 'host', player: 'self', fromSelf: true },
    });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'summary']);
    expect(state.players.self.scene[0].setCards).toEqual([]);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('records set-card to remove without exposing the card or instance identity', () => {
    const state = runCausalAtom('causal-remove-set-card', (draft) => {
      draft.players.self.scene = [sceneChar('HOST', 'host', {
        setCards: [{ cardId: 'PRIVATE-SET-CARD', instanceId: 'PRIVATE-INSTANCE', faceUp: false }],
      })];
    }, { kind: 'atom', verb: 'charRemoveSetCard', args: { uid: 'host', player: 'self', faceDownOnly: true } });

    const graph = validateCausalLog(state.log as CausalLogEntryV1[]);
    expect(graph.map((node) => node.kind)).toEqual(['declare', 'zone-move', 'summary']);
    expect(graph[1]).toMatchObject({ source: { kind: 'zone', side: 'self', zone: 'set-card' }, targets: [{ kind: 'zone', side: 'self', zone: 'remove' }], outcome: { type: 'move', from: 'set-card', to: 'remove', count: 1 } });
    expect(state.players.self.remove).toEqual(['PRIVATE-SET-CARD']);
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });
});
