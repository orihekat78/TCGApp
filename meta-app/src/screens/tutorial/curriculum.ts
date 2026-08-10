import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import type { TutorialChapter } from './types';

type LessonMeta = Omit<TutorialChapter, 'steps'>;

const LESSON_META: readonly LessonMeta[] = [
  { id: 'L0', num: 0, title: 'ゲームの目的', subtitle: '勝利条件と最初の操作', group: 'beginner' },
  { id: 'L1', num: 1, title: 'デッキの構成', subtitle: '42枚の役割と枚数制限', group: 'beginner' },
  { id: 'L2', num: 2, title: '場とカードの状態', subtitle: '8つのエリアと3つの状態', group: 'beginner' },
  { id: 'L3', num: 3, title: 'ターン進行', subtitle: 'オート・メイン・エンド', group: 'beginner' },
  { id: 'L4', num: 4, title: '推理', subtitle: 'LPを証拠へ変える', group: 'beginner' },
  { id: 'L5', num: 5, title: 'パートナー基礎', subtitle: 'アシスト・事件解決・練習', group: 'beginner' },
  { id: 'L6', num: 6, title: 'アクション宣言', subtitle: '攻撃元と対象を選ぶ', group: 'advanced' },
  { id: 'L7', num: 7, title: 'ガード判定', subtitle: '守るか資源を残すか', group: 'advanced' },
  { id: 'L8', num: 8, title: 'コンタクト', subtitle: 'AP判定と行動順', group: 'advanced' },
  { id: 'L9', num: 9, title: 'カットイン', subtitle: 'コンタクト中の割り込み', group: 'advanced' },
  { id: 'L10', num: 10, title: '変装', subtitle: 'キャラの入替と引継ぎ', group: 'advanced' },
  { id: 'L11', num: 11, title: '事件へのアクション', subtitle: 'ヒラメキと証拠移動', group: 'advanced' },
  { id: 'L12', num: 12, title: 'リフレッシュと痕跡', subtitle: 'デッキ切れと発見済み', group: 'advanced' },
  { id: 'L13', num: 13, title: 'MRキャラ', subtitle: '特別な離脱と重複登場', group: 'advanced' },
] as const;

export const PRACTICE_STEP_ID = 'L5-4';

export const TUTORIAL_CHAPTERS: TutorialChapter[] = LESSON_META.map((lesson) => ({
  ...lesson,
  steps: TUTORIAL_STEPS
    .filter((step) => step.id.startsWith(`${lesson.id}-`))
    .map((step, index) => ({ ...step, num: index + 1 })),
}));
