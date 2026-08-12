// Phase 9a-1: TutorialOverlay tests

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TutorialOverlay } from '@/ui/components/TutorialOverlay';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('TutorialOverlay', () => {
  beforeEach(() => {
    useTutorialStore.setState({ currentStep: null });
    useGameStateStore.setState({ gameState: null });
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

  it('unmounts its local modal on terminal state without mutating tutorial progress', async () => {
    const container = document.createElement('div');
    const root: Root = createRoot(container);
    useTutorialStore.setState({ currentStep: 2 });
    await act(async () => { root.render(<TutorialOverlay />); });
    expect(container.querySelector('[data-testid="tutorial-overlay"]')).not.toBeNull();

    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    await act(async () => { useGameStateStore.setState({ gameState: terminal }); });

    expect(container.querySelector('[data-testid="tutorial-overlay"]')).toBeNull();
    expect(useTutorialStore.getState().currentStep).toBe(2);
    await act(async () => { root.unmount(); });
  });
});
