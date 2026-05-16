// Phase 9a-1: tutorialSteps constants test

import { describe, it, expect } from 'vitest';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';

describe('TUTORIAL_STEPS (Phase 9a + 9b: L0-L10)', () => {
  it('has at least 26 steps (L0-L5 16 + L6-L10 10)', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(26);
  });

  it('each step has id / title / body', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.id).toBeTypeOf('string');
      expect(s.title).toBeTypeOf('string');
      expect(s.body).toBeTypeOf('string');
      expect(s.id.length).toBeGreaterThan(0);
    }
  });

  it('contains each lesson prefix L0-L10 at least once', () => {
    const prefixes = new Set(TUTORIAL_STEPS.map((s) => s.id.split('-')[0]));
    for (const p of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']) {
      expect(prefixes.has(p)).toBe(true);
    }
  });

  it('all ids are unique', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('body length is reasonable for subtitle bar (each ≤ 200 chars)', () => {
    for (const s of TUTORIAL_STEPS) {
      expect(s.body.length).toBeLessThanOrEqual(200);
    }
  });
});
