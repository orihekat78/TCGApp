import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresentationStore } from '@/ui/presentation/store';
import { useGameStateStore } from '@/ui/state/store';

describe('presentation controls', () => {
  let originalGameStore: ReturnType<typeof useGameStateStore.getState>;
  let originalPresentationStore: ReturnType<typeof usePresentationStore.getState>;

  beforeEach(() => {
    originalGameStore = useGameStateStore.getState();
    originalPresentationStore = usePresentationStore.getState();
    usePresentationStore.setState({
      presentationPaused: false,
      presentationStepToken: 0,
      presentationSkipToken: 0,
      presentationCompletionNotice: null,
    });
    useGameStateStore.setState({
      aiSpeedMs: 800,
      isAiPaused: true,
      aiStepCounter: 17,
      dispatch: vi.fn(originalGameStore.dispatch),
    });
  });

  afterEach(() => {
    useGameStateStore.setState(originalGameStore, true);
    usePresentationStore.setState(originalPresentationStore, true);
  });

  it('changes only transient presentation state', () => {
    const aiBefore = aiSnapshot();
    const controls = usePresentationStore.getState();

    controls.setPresentationPaused(true);
    controls.stepPresentation();
    controls.skipPresentation();

    expect(usePresentationStore.getState()).toMatchObject({
      presentationPaused: true,
      presentationStepToken: 1,
      presentationSkipToken: 1,
    });
    expect(aiSnapshot()).toEqual(aiBefore);
    expect(useGameStateStore.getState().dispatch).not.toHaveBeenCalled();
  });

  it('resets presentation state without resetting AI state', () => {
    usePresentationStore.getState().setPresentationPaused(true);
    usePresentationStore.getState().stepPresentation();
    const aiBefore = aiSnapshot();

    usePresentationStore.getState().resetPresentationControls();

    expect(usePresentationStore.getState()).toMatchObject({
      presentationPaused: false,
      presentationStepToken: 1,
      presentationSkipToken: 1,
    });
    expect(aiSnapshot()).toEqual(aiBefore);
    expect(useGameStateStore.getState().dispatch).not.toHaveBeenCalled();
  });

  it('clears completion notices by default but can preserve one for the result route', () => {
    const notice = { kind: 'terminal' as const, count: 3 };
    usePresentationStore.getState().setPresentationCompletionNotice(notice);

    usePresentationStore.getState().resetPresentationControls({ preserveCompletionNotice: true });
    expect(usePresentationStore.getState().presentationCompletionNotice).toEqual(notice);

    usePresentationStore.getState().resetPresentationControls();
    expect(usePresentationStore.getState().presentationCompletionNotice).toBeNull();
  });
});

function aiSnapshot() {
  const state = useGameStateStore.getState();
  return {
    aiSpeedMs: state.aiSpeedMs,
    isAiPaused: state.isAiPaused,
    aiStepCounter: state.aiStepCounter,
    oppMoveTick: state.oppMoveTick,
    gameState: state.gameState,
    pendingEffectPick: state.pendingEffectPick,
    pendingEffectChoice: state.pendingEffectChoice,
    pendingEffectOptional: state.pendingEffectOptional,
    pendingEffectRepeatOptional: state.pendingEffectRepeatOptional,
    pendingChooseIntercept: state.pendingChooseIntercept,
    pendingLeaveIntercept: state.pendingLeaveIntercept,
    pendingRps: state.pendingRps,
    pendingSetCardChoice: state.pendingSetCardChoice,
    pendingSetCardReplacement: state.pendingSetCardReplacement,
    pendingDeckReveal: state.pendingDeckReveal,
    pendingPublicHandReveal: state.pendingPublicHandReveal,
    pendingDeckReorder: state.pendingDeckReorder,
    pendingDeckPlace: state.pendingDeckPlace,
  };
}
