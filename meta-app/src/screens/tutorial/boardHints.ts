// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-C: 盤面スナップショット step の強調ゾーン定義。
// selector は src Playmat 内のゾーン CSS クラス (.scene-area.side-self 等)。
// viewer 右ペインの一覧 hover で該当ゾーンを pulse 強調 (該当箇所強調)。

import type { ZoneHint } from './TutorialBoardSnapshot';

export const STEP_BOARD_ZONES: Record<string, ZoneHint[]> = {
  // ch1-2 場の 8 エリア (自陣をすべて指し示す)
  'ch1-2': [
    { selector: '.scene-area.side-self', label: '現場 — キャラ最大 5 枚' },
    { selector: '.partner-area.side-self', label: 'パートナー' },
    { selector: '.case-area.side-self', label: '事件 (横向きカード)' },
    { selector: '.file-area.side-self', label: 'FILE — 7 枚で解決編へ' },
    { selector: '.evidence-area.side-self', label: '証拠 — 勝利条件' },
    { selector: '.deck-area.side-self', label: 'デッキ' },
    { selector: '.remove-area.side-self', label: 'リムーブ' },
    { selector: '.hand-zone', label: '手札 (非公開)' },
  ],
  // ch3-1 ゲーム開始
  'ch3-1': [
    { selector: '.case-area.side-self', label: '事件を配置 → 表向き' },
    { selector: '.partner-area.side-self', label: 'パートナーを配置 → 表向き' },
    { selector: '.deck-area.side-self', label: 'デッキから 5 枚ドロー' },
    { selector: '.hand-zone', label: '手札 (マリガン 1 回可)' },
  ],
  // ch3-2 3 フェイズ
  'ch3-2': [
    { selector: '.partner-area.side-self', label: 'オート: パートナーをアクティブ' },
    { selector: '.deck-area.side-self', label: 'オート: 1 ドロー' },
    { selector: '.file-area.side-self', label: 'オート: FILE 2 枚 (初手1)' },
    { selector: '.scene-area.side-self', label: 'メイン: 推理 / アクション等' },
  ],
  // ch4-1 推理
  'ch4-1': [
    { selector: '.partner-area.side-self', label: 'アクティブをスリープ → 推理' },
    { selector: '.scene-area.side-self', label: 'キャラでも推理可' },
    { selector: '.evidence-area.side-self', label: 'LP 枚分の証拠を獲得' },
  ],
  // ch4-2 アクション + ガード
  'ch4-2': [
    { selector: '.scene-area.side-self', label: '自キャラをスリープして宣言' },
    { selector: '.scene-area.side-opp', label: '対象 = スリープ/スタンの相手キャラ' },
  ],
  // ch4-3 コンタクト判定
  'ch4-3': [
    { selector: '.scene-area.side-self', label: '攻撃キャラの AP' },
    { selector: '.scene-area.side-opp', label: '対象キャラの AP と比較' },
  ],
  // ch4-4 ネクストヒント
  'ch4-4': [
    { selector: '.file-area.side-self', label: 'FILE 上 1 枚を手札へ' },
    { selector: '.hand-zone', label: 'FILE 枚数以下の手札を即使用' },
  ],
  // ch4-5 リフレッシュ + 敗北
  'ch4-5': [
    { selector: '.deck-area.side-self', label: 'デッキ 0 → リフレッシュ' },
    { selector: '.remove-area.side-self', label: 'リムーブをシャッフルしデッキへ' },
    { selector: '.evidence-area.side-opp', label: '相手は証拠 +1' },
  ],
  // ch5-1 事件編 → 解決編
  'ch5-1': [
    { selector: '.file-area.side-self', label: 'FILE 7 枚以上' },
    { selector: '.case-area.side-self', label: 'アシストで解決編へ (一方通行)' },
  ],
  // ch5-2 必要証拠数
  'ch5-2': [
    { selector: '.evidence-area.side-self', label: '先攻 7 / 後攻 6 を集める' },
  ],
  // ch5-3 事件解決
  'ch5-3': [
    { selector: '.partner-area.side-self', label: 'アクティブパートナーをスリープ' },
    { selector: '.case-area.side-self', label: '解決編 + 必要証拠 → 勝利' },
  ],
  // ch5-4 アシスト勝利不可
  'ch5-4': [
    { selector: '.partner-area.side-self', label: 'アシスト = スリープで FILE へ' },
    { selector: '.file-area.side-self', label: '同ターンは事件解決の前提を満たさない' },
  ],
};
