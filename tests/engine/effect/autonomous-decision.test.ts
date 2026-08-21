import { describe, expect, it } from 'vitest';
import {
  autonomousDeckPlacement,
  autonomousDeckReorder,
  chooseAutonomousReplacementTarget,
  chooseAutonomousRpsHand,
  chooseAutonomousSetCardInstance,
} from '@/engine/effect/autonomous-decision';

describe('autonomous non-human decision fallbacks', () => {
  it('chooses either non-tie RPS hand with an even split boundary', () => {
    expect(chooseAutonomousRpsHand('rock', () => 0)).toBe('paper');
    expect(chooseAutonomousRpsHand('rock', () => 0.4999)).toBe('paper');
    expect(chooseAutonomousRpsHand('rock', () => 0.5)).toBe('scissors');
    expect(chooseAutonomousRpsHand('rock', () => 0.9999)).toBe('scissors');
  });

  it('chooses the last eligible set-card occurrence', () => {
    expect(chooseAutonomousSetCardInstance([{ instanceId: 'first' }, { instanceId: 'last' }])).toBe('last');
    expect(chooseAutonomousSetCardInstance([])).toBeNull();
  });

  it('chooses the first eligible replacement target', () => {
    expect(chooseAutonomousReplacementTarget([{ uid: 'first' }, { uid: 'last' }])).toBe('first');
    expect(chooseAutonomousReplacementTarget([])).toBeNull();
  });

  it('keeps autonomous deck reorder stable without aliasing the input', () => {
    const cards = ['A', 'B'];
    const order = autonomousDeckReorder(cards);
    expect(order).toEqual(cards);
    expect(order).not.toBe(cards);
  });

  it('places every autonomous deck card on top in stable order', () => {
    expect(autonomousDeckPlacement(['A', 'B'])).toEqual({ top: ['A', 'B'], bottom: [] });
  });
});
