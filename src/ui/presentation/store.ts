import { create } from 'zustand';

export type PresentationCompletionNotice =
  | { kind: 'skip'; count: number }
  | { kind: 'terminal'; count: number };

export type PresentationControlState = {
  presentationPaused: boolean;
  presentationStepToken: number;
  presentationSkipToken: number;
  presentationError: string | null;
  presentationCompletionNotice: PresentationCompletionNotice | null;
  setPresentationPaused: (paused: boolean) => void;
  stepPresentation: () => void;
  skipPresentation: () => void;
  setPresentationError: (error: string | null) => void;
  setPresentationCompletionNotice: (notice: PresentationCompletionNotice | null) => void;
  resetPresentationControls: (options?: { preserveCompletionNotice?: boolean }) => void;
};

/** Presentation-only state. It deliberately has no dependency on engine or AI stores. */
export const usePresentationStore = create<PresentationControlState>((set) => ({
  presentationPaused: false,
  presentationStepToken: 0,
  presentationSkipToken: 0,
  presentationError: null,
  presentationCompletionNotice: null,
  setPresentationPaused: (presentationPaused) => set({ presentationPaused }),
  stepPresentation: () => set((state) => ({
    presentationStepToken: state.presentationStepToken + 1,
  })),
  skipPresentation: () => set((state) => ({
    presentationSkipToken: state.presentationSkipToken + 1,
  })),
  setPresentationError: (presentationError) => set({ presentationError }),
  setPresentationCompletionNotice: (presentationCompletionNotice) => set({ presentationCompletionNotice }),
  resetPresentationControls: (options = {}) => set((state) => ({
    presentationPaused: false,
    presentationSkipToken: state.presentationSkipToken + 1,
    presentationError: null,
    presentationCompletionNotice: options.preserveCompletionNotice
      ? state.presentationCompletionNotice
      : null,
  })),
}));
