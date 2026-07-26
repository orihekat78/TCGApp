import { describe, expect, it } from 'vitest';
import { B10069 } from '@/cards/ct-p10/B10069';

describe('CT-P10 B10069', () => {
  it('uses the resolving source AP and still draws when no character is removed', () => {
    expect(B10069.abilities[1]).toMatchObject({
      type: 'declared', limit: { kind: 'turn', n: 1 },
      cost: { kind: 'removeFromHand', n: 1 },
      effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { kind: 'character', apMaxSource: true } } },
        { kind: 'atom', verb: 'draw', args: { n: 1 } },
      ] },
    });
  });
});
