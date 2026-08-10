import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import { TUTORIAL_CHAPTERS } from '../../meta-app/src/screens/TutorialScreen';
import { hasCanonicalTutorialVisual } from '../../meta-app/src/screens/tutorial/canonicalVisuals';

describe('TutorialScreen canonical curriculum', () => {
  it('derives all L0-L13 lessons and their exact step order from the match tutorial', () => {
    expect(TUTORIAL_CHAPTERS.map((lesson) => lesson.num))
      .toEqual(Array.from({ length: 14 }, (_entry, index) => index));
    expect(TUTORIAL_CHAPTERS.map((lesson) => lesson.steps.length))
      .toEqual([3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 2, 3, 2]);

    const metaSteps = TUTORIAL_CHAPTERS.flatMap((lesson) => lesson.steps);
    expect(metaSteps.map((step) => step.id)).toEqual(TUTORIAL_STEPS.map((step) => step.id));
    expect(metaSteps.map(({ id, title, body, target }) => ({ id, title, body, target })))
      .toEqual(TUTORIAL_STEPS);
    expect(metaSteps.some((step) => step.id.startsWith('ch'))).toBe(false);
  });

  it('provides a real visual for every canonical lesson step', () => {
    expect(TUTORIAL_STEPS.filter((step) => !hasCanonicalTutorialVisual(step.id)))
      .toEqual([]);
  });
});
