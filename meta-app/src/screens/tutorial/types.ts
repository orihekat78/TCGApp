// spec: .claude/specs/meta-ui/15-tutorial-lesson-viewer.md
// チュートリアルレッスン / ステップの型。

import type { TutorialTarget } from '@/ui/services/tutorialSteps';

export interface TutorialStep {
  id: string;
  num: number;
  title: string;
  body: string;
  target?: TutorialTarget;
}

export interface TutorialChapter {
  id: string;
  num: number;
  title: string;
  subtitle: string;
  group: 'beginner' | 'advanced';
  steps: TutorialStep[];
}
