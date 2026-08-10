import type { ReactNode } from 'react';
import { STEP_BOARD_ZONES } from './boardHints';
import { STEP_ILLUSTRATIONS } from './illustrations';
import type { ZoneHint } from './TutorialBoardSnapshot';

type Concept = readonly [string, ...string[]];

const CONCEPTS: Record<string, Concept> = {
  'L0-1': ['カード対戦', '証拠を集める', '事件を解決'],
  'L0-2': ['必要証拠 7 / 6', '事件・解決編', '事件解決を宣言'],
  'L0-3': ['ACTIONS', '行動を選ぶ', 'ターン終了'],
  'L1-1': ['パートナー 1', '事件 1', 'メイン 40'],
  'L1-2': ['同じ ID', '最大 3 枚', '使用時は事件と同色'],
  'L2-1': ['現場・パートナー・事件', 'デッキ・証拠・FILE', 'リムーブ・手札'],
  'L2-2': ['アクティブ', 'スリープ', 'スタン'],
  'L3-1': ['オート', 'メイン', 'エンド'],
  'L3-2': ['全員をアクティブ', '1 枚ドロー', 'FILE +2'],
  'L3-3': ['手札・NH・能力', '推理・アクション', '好きな順で行動'],
  'L4-1': ['味方をスリープ', 'LP を確認', '証拠を獲得'],
  'L4-2': ['LP 3', '推理', '証拠 +3'],
  'L5-1': ['パートナー', 'アシスト', 'FILE 7 → 解決編'],
  'L5-2': ['解決編 + 必要証拠', 'パートナーをスリープ', '勝利'],
  'L5-3': ['登場ターン', '名乗り状態', '迅速・突撃は例外'],
  'L5-4': ['ターン終了', 'オートを体験', '推理・アクション'],
  'L6-1': ['攻撃元を選ぶ', '対象を選ぶ', 'アクション宣言'],
  'L6-2': ['宣言', 'ガード', 'コンタクト・判定'],
  'L7-1': ['攻撃対象', '別の味方でガード', '対象を置換'],
  'L7-2': ['ガードする', '比較して判断', '資源を温存'],
  'L8-1': ['攻撃側 AP', '≧', '防御側をリムーブ'],
  'L8-2': ['低 AP 側', '行動順を往復', '高 AP 側'],
  'L9-1': ['コンタクト中', 'カットイン 1 枚', 'AP などを変更'],
  'L9-2': ['AP 判定前', 'カットイン', '使用後はリムーブ'],
  'L10-1': ['現場キャラ', '変装', '手札キャラと入替'],
  'L10-2': ['登場時は発動しない', '変装時', '専用能力を解決'],
  'L11-1': ['相手事件へアクション', '相手証拠 −1', '自分証拠 +1'],
  'L11-2': ['証拠をリムーブ', 'ヒラメキ確認', '効果を発動'],
  'L12-1': ['デッキ 0', 'リムーブをシャッフル', '相手証拠 +1'],
  'L12-2': ['デッキ 0', 'リムーブ 0', '即敗北'],
  'L12-3': ['相手がリフレッシュ', '痕跡', '発見済みを維持'],
  'L13-1': ['相手ターンに離脱', 'MR', 'パートナーエリアへ'],
  'L13-2': ['新しい MR が登場', '既存 MR', '強制リムーブ'],
};

const BOARD_ALIASES: Record<string, string> = {
  'L0-1': 'ch3-1',
  'L0-2': 'ch5-2',
  'L2-1': 'ch1-2',
  'L3-1': 'ch3-2',
  'L4-1': 'ch4-1',
  'L5-1': 'ch5-1',
  'L5-2': 'ch5-3',
  'L6-2': 'ch4-2',
  'L7-1': 'ch4-2',
  'L8-1': 'ch4-3',
  'L12-1': 'ch4-5',
};

const ILLUSTRATION_ALIASES: Record<string, string> = {
  'L1-1': 'ch1-1',
  'L2-2': 'ch8-3',
  'L3-3': 'ch4-4',
  'L5-3': 'ch7-3',
  'L5-4': 'ch5-5',
  'L9-2': 'ch6-3',
  'L12-3': 'ch7-6',
  'L13-1': 'ch8-1',
};

export interface CanonicalTutorialVisual {
  zones?: ZoneHint[];
  illustration: ReactNode;
}

function ConceptDiagram({ stepId, nodes }: { stepId: string; nodes: Concept }) {
  return (
    <figure className="tutorial-concept" aria-label={`${stepId} の手順図`}>
      <figcaption>{stepId}</figcaption>
      <div className="tutorial-concept-flow">
        {nodes.map((label, index) => (
          <div className="tutorial-concept-part" key={`${stepId}:${label}`}>
            {index > 0 && <span className="tutorial-concept-arrow" aria-hidden="true">→</span>}
            <span className="tutorial-concept-node">{label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function resolveCanonicalTutorialVisual(stepId: string): CanonicalTutorialVisual | null {
  const concept = CONCEPTS[stepId];
  if (!concept) return null;
  const boardSource = BOARD_ALIASES[stepId];
  const illustrationSource = ILLUSTRATION_ALIASES[stepId];
  return {
    zones: boardSource ? STEP_BOARD_ZONES[boardSource] : undefined,
    illustration: illustrationSource
      ? STEP_ILLUSTRATIONS[illustrationSource]
      : <ConceptDiagram stepId={stepId} nodes={concept} />,
  };
}

export function hasCanonicalTutorialVisual(stepId: string): boolean {
  const visual = resolveCanonicalTutorialVisual(stepId);
  return Boolean(visual && (visual.zones?.length || visual.illustration));
}
