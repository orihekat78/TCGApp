// spec: .claude/specs/meta-ui/15-tutorial-lesson-viewer.md
// チュートリアル章 / ステップの型 (TutorialScreen と LessonViewer の循環依存回避)

export interface TutorialStep {
  id: string;        // 'ch1-1' 等 (STEP_ILLUSTRATIONS のキー)
  num: number;
  title: string;
  body: string;
}

export interface TutorialChapter {
  num: number;
  title: string;
  subtitle: string;
  group: 'beginner' | 'advanced';
  steps: TutorialStep[];
}
