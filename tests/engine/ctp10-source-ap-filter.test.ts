// CT-P10 B10069: both AP values are read at resolution time, including buffs.
import { beforeAll, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { candidates } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';

describe('CT-P10 source AP target filter', () => {
  beforeAll(() => registerAll());

  it('uses the source effective AP and fails closed without a source uid', () => {
    const state = createEmptyGameState();
    const source = sceneChar('D11013', 'source', { apOverride: 7000, turnEffects: { apMod_turn: 1000 } });
    state.players.self.scene = [source];
    state.players.opp.scene = [
      sceneChar('D11013', 'equal', { apOverride: 8000 }),
      sceneChar('D11013', 'above', { apOverride: 8001 }),
    ];
    const ref = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'either' as const, filter: { apMaxSource: true as const } } };
    const ctx = { source: { player: 'self' as const, cardId: 'D11013', uid: 'source', area: 'scene' as const }, bindings: {} };
    expect(candidates(state, ref, ctx).map(c => c.uid).sort()).toEqual(['equal', 'source']);
    expect(candidates(state, ref, { ...ctx, source: { ...ctx.source, uid: undefined } }).length).toBe(0);
  });
});
