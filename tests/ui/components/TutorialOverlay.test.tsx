// Phase 9a-1: TutorialOverlay tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TutorialOverlay } from '@/ui/components/TutorialOverlay';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';

describe('TutorialOverlay', () => {
  beforeEach(() => {
    useTutorialStore.setState({ currentStep: null });
  });

  it('renders nothing when currentStep === null', () => {
    const html = renderToString(<TutorialOverlay />);
    expect(html).toBe('');
  });

  it('renders L0-1 title + body when currentStep === 0', () => {
    useTutorialStore.setState({ currentStep: 0 });
    const html = renderToString(<TutorialOverlay />);
    expect(html).toContain(TUTORIAL_STEPS[0].title);
    expect(html).toContain(TUTORIAL_STEPS[0].body);
    expect(html).toContain('data-testid="tutorial-overlay"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-testid="tutorial-next"');
  });
});
