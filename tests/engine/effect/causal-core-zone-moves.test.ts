import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { produce } from '@/engine/produce';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CausalLogEntryV1, EffectNode, EffectStackEntry, GameState } from '@/engine/types';

function runCausalAtom(
  sessionId: string,
  effect: EffectNode,
  setup: (state: GameState) => void,
): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);
  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: {
        player: 'self', cardId: 'PRIVATE-SOURCE', uid: 'private-source-uid', abilityId: 'a1', area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect,
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

function operationShape(state: GameState): Array<[string, string[] | undefined, CausalLogEntryV1['outcome']]> {
  return validateCausalLog(state.log as CausalLogEntryV1[])
    .filter((entry) => entry.kind !== 'declare' && entry.kind !== 'summary')
    .map((entry) => [entry.kind, entry.tags, entry.outcome]);
}

describe('causal coverage for core public zone moves', () => {
  it('records mill before the refresh caused by exhausting the deck', () => {
    const state = runCausalAtom(
      'causal-mill-refresh',
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } },
      (draft) => {
        draft.players.self.deck = ['PRIVATE-DRAW-1', 'PRIVATE-DRAW-2'];
        draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
      },
    );

    expect(operationShape(state)).toEqual([
      ['zone-move', undefined, { type: 'move', from: 'deck', to: 'remove', count: 2 }],
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 4 }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it.each([
    ['before', [], ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'], [
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['zone-move', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
    ]],
    ['after', ['PRIVATE-DRAW'], ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'], [
      ['zone-move', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
    ]],
  ] as const)('records a deck-bottom hand move with refresh %s the move', (_label, deck, remove, expected) => {
    const state = runCausalAtom(
      `causal-bottom-${_label}`,
      { kind: 'atom', verb: 'handAddFromDeckBottom', args: { player: 'self' } },
      (draft) => {
        draft.players.self.deck = [...deck];
        draft.players.self.remove = [...remove];
      },
    );

    expect(operationShape(state)).toEqual(expected);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records hand-to-deck, draw, then exact-exhaustion refresh in printed order', () => {
    const state = runCausalAtom(
      'causal-hand-bottom-draw',
      {
        kind: 'atom', verb: 'handToDeckBottom',
        args: { player: 'self', cardIds: ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'], shuffleThenDrawMoved: true },
      },
      (draft) => {
        draft.players.self.hand = ['PRIVATE-HAND-1', 'PRIVATE-HAND-2'];
        draft.players.self.remove = ['PRIVATE-REMOVE'];
      },
    );

    expect(operationShape(state)).toEqual([
      ['zone-move', undefined, { type: 'move', from: 'hand', to: 'deck', count: 2 }],
      ['draw', undefined, { type: 'move', from: 'deck', to: 'hand', count: 2 }],
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 1 }],
    ]);
  });

  it.each([
    ['fileAdd', 'file', 'zone-move'],
    ['evidenceGain', 'evidence', 'evidence'],
  ] as const)('records %s before its exact-exhaustion refresh', (verb, to, kind) => {
    const state = runCausalAtom(
      `causal-${verb}-refresh`,
      { kind: 'atom', verb, args: { player: 'self', n: 1 } },
      (draft) => {
        draft.players.self.deck = ['PRIVATE-DRAW'];
        draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
      },
    );

    expect(operationShape(state)).toEqual([
      [kind, undefined, { type: 'move', from: 'deck', to, count: 1 }],
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records a selected deck-to-hand move before its exact-exhaustion refresh', () => {
    const state = runCausalAtom(
      'causal-selected-deck-hand-refresh',
      { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: 'PRIVATE-DRAW' } },
      (draft) => {
        draft.players.self.deck = ['PRIVATE-DRAW'];
        draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
      },
    );

    expect(operationShape(state)).toEqual([
      ['zone-move', undefined, { type: 'move', from: 'deck', to: 'hand', count: 1 }],
      ['zone-move', ['refresh'], { type: 'move', from: 'remove', to: 'deck', count: 2 }],
    ]);
  });

  it('records a selected remove-to-deck move without exposing the selected card ID', () => {
    const state = runCausalAtom(
      'causal-remove-deck-top',
      {
        kind: 'atom', verb: 'removeAreaToDeckTop',
        args: { player: 'self', target: 'PRIVATE-REMOVE-1' },
      },
      (draft) => {
        draft.players.self.remove = ['PRIVATE-REMOVE-1', 'PRIVATE-REMOVE-2'];
      },
    );

    expect(operationShape(state)).toEqual([
      ['zone-move', undefined, { type: 'move', from: 'remove', to: 'deck', count: 1 }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });

  it('records each populated side when all remove cards return to deck bottom', () => {
    const state = runCausalAtom(
      'causal-remove-all-deck-bottom',
      { kind: 'atom', verb: 'removeAreaAllToDeckBottom', args: {} },
      (draft) => {
        draft.players.self.remove = ['PRIVATE-SELF-1', 'PRIVATE-SELF-2'];
        draft.players.opp.remove = ['PRIVATE-OPP-1'];
      },
    );

    expect(operationShape(state)).toEqual([
      ['zone-move', undefined, { type: 'move', from: 'remove', to: 'deck', count: 2 }],
      ['zone-move', undefined, { type: 'move', from: 'remove', to: 'deck', count: 1 }],
    ]);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-');
  });
});
