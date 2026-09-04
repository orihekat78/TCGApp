import { describe, expect, it } from 'vitest';
import { continuationMayEnterSceneForPlayer } from '@/engine/effect/scene-switch';
import type { EffectCtx } from '@/engine/types/effect-ctx';
import type { Effect } from '@/engine/types';

const ctx: EffectCtx = {
  source: { player: 'self', cardId: 'SOURCE', uid: 'source', area: 'scene' },
  bindings: {},
};

function continuation(...remainder: Effect[]) {
  return { remainder, kind: 'sequence' as const, ctx };
}

describe('continuation scene-switch authority', () => {
  it.each([
    ['short form', { player: 'self', from: 'remove', max: 1 }],
    ['$pick.cardId', { player: 'self', cardId: '$pick.cardId', target: { kind: 'pick' } }],
    ['$pick.cardIds', { player: 'self', cardIds: '$pick.cardIds', target: { kind: 'pick' } }],
  ])('defers %s scene entry to its own pending decision', (_label, args) => {
    const frame = continuation({ kind: 'atom', verb: 'sceneEnter', args });
    expect(continuationMayEnterSceneForPlayer(frame, 'self')).toBe(false);
    expect(continuationMayEnterSceneForPlayer(frame, 'opp')).toBe(false);
  });

  it('keeps bundled authority for a fixed bound scene entry', () => {
    const frame = continuation({
      kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId' },
    });
    expect(continuationMayEnterSceneForPlayer(frame, 'self')).toBe(true);
    expect(continuationMayEnterSceneForPlayer(frame, 'opp')).toBe(false);
  });

  it('does not scan past a pick-producing scene entry to a later fixed entry', () => {
    const frame = continuation(
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'opp', cardId: 'FIXED' } },
    );
    expect(continuationMayEnterSceneForPlayer(frame, 'self')).toBe(false);
    expect(continuationMayEnterSceneForPlayer(frame, 'opp')).toBe(false);
  });
});
