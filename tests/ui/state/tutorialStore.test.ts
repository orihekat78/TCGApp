// Phase 9a-1: tutorialStore behavior tests

import { describe, it, expect, beforeEach } from 'vitest';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';

describe('useTutorialStore', () => {
  beforeEach(() => {
    useTutorialStore.setState({ currentStep: null });
  });

  it('initial state: currentStep === null', () => {
    expect(useTutorialStore.getState().currentStep).toBe(null);
  });

  it('start() → 0, next() → 1, exit() → null', () => {
    const { start, next, exit } = useTutorialStore.getState();
    start();
    expect(useTutorialStore.getState().currentStep).toBe(0);
    next();
    expect(useTutorialStore.getState().currentStep).toBe(1);
    exit();
    expect(useTutorialStore.getState().currentStep).toBe(null);
  });

  it('next() at last step → auto exit (null)', () => {
    const { start, next } = useTutorialStore.getState();
    start();
    // (length - 1) 回 next を呼ぶと最終ステップ。さらに 1 回 next で null。
    for (let i = 0; i < TUTORIAL_STEPS.length - 1; i++) next();
    expect(useTutorialStore.getState().currentStep).toBe(TUTORIAL_STEPS.length - 1);
    next();
    expect(useTutorialStore.getState().currentStep).toBe(null);
  });

  it('prev() at step 0 → stays 0 (no underflow)', () => {
    const { start, prev } = useTutorialStore.getState();
    start();
    prev();
    expect(useTutorialStore.getState().currentStep).toBe(0);
  });
});
