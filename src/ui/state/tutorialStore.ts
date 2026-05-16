// Phase 9a-1: チュートリアル進行ストア
//
// 全カリキュラム ([.claude/research/tutorial/01-curriculum-design.md]) のうち
// 現在ステップ番号 (TUTORIAL_STEPS の index) を管理する独立 Zustand store。
// GameState とは分離し、engine 骨格に影響しない設計。

import { create } from 'zustand';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps.js';

type TutorialStore = {
  /** 現在のステップ index。null ならチュートリアル非起動 */
  currentStep: number | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  exit: () => void;
};

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  currentStep: null,
  start: () => set({ currentStep: 0 }),
  next: () => {
    const cur = get().currentStep;
    if (cur === null) return;
    const nxt = cur + 1;
    set({ currentStep: nxt >= TUTORIAL_STEPS.length ? null : nxt });
  },
  prev: () => {
    const cur = get().currentStep;
    if (cur === null || cur === 0) return;
    set({ currentStep: cur - 1 });
  },
  exit: () => set({ currentStep: null }),
}));
