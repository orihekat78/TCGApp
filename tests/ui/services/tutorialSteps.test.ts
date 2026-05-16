// Phase 9a-1: tutorialSteps constants test

import { describe, it, expect } from 'vitest';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';

describe('TUTORIAL_STEPS (Phase 9a-1: L0 only)', () => {
  it('has at least 3 steps (L0-1 / L0-2 / L0-3)', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(3);
  });

  it('each step has id / title / body', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.id).toBeTypeOf('string');
      expect(s.title).toBeTypeOf('string');
      expect(s.body).toBeTypeOf('string');
      expect(s.id.length).toBeGreaterThan(0);
    }
  });
});
