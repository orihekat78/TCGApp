// Phase 7.5: ActionsPanel
// 画面右側の操作パネル。6 つのメインアクション + Phase 切替 + END ターン。
// Phase 7 では静的表示のみ (props で状態を受け取る)。
// 実際の操作配線は Phase 8。

import type { JSX } from 'react';
import './ActionsPanel.css';

export type PhaseId = 'auto' | 'main' | 'end';

export type ActionsPanelProps = {
  /** 手札の使用: 残り回数 (turnState.handUseUsed が true なら 0) と手札枚数 */
  handCount: number;
  handUseRemaining: number;
  /**
   * 2026-05-29 user_request: 手札の使用が不可なとき、その理由を区別して表示するため。
   * - handUseUsed=true: 実際に使用済 → 「使用済」
   * - handUseUsed=false かつ nextHintUsed=true: ネクストヒントでブロック (消費ではない、rules/05)
   *   → 「ネクストヒント使用のため不可」と表示し「カウントが減った」誤解を防ぐ。
   */
  handUseUsed?: boolean;
  /** ネクストヒント: 使用可否は呼び出し側で判定済み、FILE 枚数を表示 */
  nextHintFileCount: number;
  nextHintUsed: boolean;
  /**
   * 2026-05-28 バグ2 修正: NH は rules/05 で「制限なし」(同ターン何度でも可)。
   * canStartNextHint (FILE に非アシストカード ≥1) を呼び出し側が渡す。
   * 旧実装は disabled に nextHintUsed を含め 1 回で塞いでいた (バグ)。
   */
  canNextHint: boolean;
  /** パートナー能力: パートナーが active でなければ disabled */
  partnerActive: boolean;
  /** 宣言可能かつコスト支払可能なパートナー能力数 */
  partnerAbilityCount: number;
  /** 宣言能力: 利用可能対象数 */
  declaredTargetCount: number;
  /** 推理: 合計 LP (パートナー + active scene キャラ) */
  reasoningTotalLP: number;
  /** アシスト可否 (move-enumerator.canAssist と同条件) */
  canAssist?: boolean;
  /** 事件解決可否 (move-enumerator.canSolveCase と同条件) */
  canSolveCase?: boolean;
  /**
   * 効果解決中ロック (rules/05 割り込み禁止 / rules/15 未解決効果)。
   * true の間は全メインアクションを disabled にしてクリックを塞ぐ
   * (必要 decision modal / 盤面 pick はロック対象外)。
   */
  interactionLocked?: boolean;
  /** アクション: 対象選択中等の現在モード ('idle' なら未選択) */
  actionMode: 'idle' | 'selecting-target' | 'in-progress';
  /** 現在の Phase (auto / main / end) */
  currentPhase: PhaseId;
  /** END ターン押下可否 (Phase 7.5 は常時 true、Phase 8 で制御) */
  canEndTurn: boolean;
  /** END ターン終了 ボタンクリック (Phase 8.5 で配線) */
  onEndTurn?: () => void;
  /** 6 行動 のクリック (Phase 8.5 で onEndTurn 以外はスタブ、8.6+ で配線) */
  onActionItemClick?: (actionId: ActionItemId) => void;
  /** ナレーター文言: 操作ガイダンス (Phase 7.5 までは stage 下部に表示、8.5 でここへ移動) */
  narratorMessage?: string;
  /** LOG ボタン用: エントリ数 / 開閉状態 / トグルコールバック */
  logEntryCount?: number;
  logOpen?: boolean;
  onLogToggle?: () => void;
};

export type ActionItemId =
  | 'hand-use'
  | 'next-hint'
  | 'partner-ability'
  | 'declared-ability'
  | 'reasoning'
  | 'action'
  | 'assist'
  | 'solve-case';

type ActionItem = {
  id: string;
  label: string;
  subtitle: string;
  disabled?: boolean;
  active?: boolean;
};

const PHASE_LABEL: Record<PhaseId, { en: string; jp: string }> = {
  auto: { en: 'AUTO', jp: 'オート' },
  main: { en: 'MAIN', jp: 'メイン' },
  end:  { en: 'END',  jp: 'エンド' },
};

export function ActionsPanel(props: ActionsPanelProps): JSX.Element {
  const {
    handCount, handUseRemaining, handUseUsed = false,
    nextHintFileCount, nextHintUsed, canNextHint,
    partnerActive, partnerAbilityCount,
    declaredTargetCount,
    reasoningTotalLP,
    canAssist = false,
    canSolveCase = false,
    interactionLocked = false,
    actionMode,
    currentPhase,
    canEndTurn,
    onEndTurn,
    onActionItemClick,
    narratorMessage,
    logEntryCount = 0,
    logOpen = false,
    onLogToggle,
  } = props;

  const actionModeLabel =
    actionMode === 'selecting-target' ? '対象選択中' :
    actionMode === 'in-progress'      ? '処理中' :
    '待機中';

  const items: ActionItem[] = [
    {
      id: 'hand-use',
      label: '手札の使用',
      // 2026-05-29 user_request: NH でブロックされた場合は「消費」ではなく理由を明示。
      subtitle: handUseUsed
        ? `${handCount}枚 / 使用済`
        : nextHintUsed
          ? 'ネクストヒント使用のため不可'
          : `${handCount}枚 / 残${handUseRemaining}回`,
      disabled: handUseRemaining <= 0 || handCount === 0,
    },
    {
      id: 'next-hint',
      // 2026-05-28 バグ2 修正: NH は「制限なし」(rules/05)。disabled は canNextHint
      // (= canStartNextHint: FILE に非アシストカード ≥1) のみで判定。nextHintUsed は見ない。
      // nextHintUsed は subtitle 表示用に残す (NH 済の視覚ヒント)。
      label: 'ネクストヒント',
      subtitle: nextHintUsed ? `FILE ${nextHintFileCount}枚 (使用済)` : `FILE ${nextHintFileCount}枚`,
      disabled: !canNextHint,
    },
    {
      id: 'partner-ability',
      label: 'パートナーの能力',
      subtitle: partnerAbilityCount === 0 ? '能力なし' : partnerActive ? '使用可' : 'スリープ中',
      disabled: !partnerActive || partnerAbilityCount === 0,
    },
    {
      id: 'declared-ability',
      label: '宣言能力',
      subtitle: `対象 ${declaredTargetCount}キャラ`,
      disabled: declaredTargetCount === 0,
    },
    {
      id: 'reasoning',
      label: '推理',
      subtitle: `LP 計 ${reasoningTotalLP}`,
      disabled: reasoningTotalLP === 0,
    },
    {
      id: 'action',
      label: 'アクション',
      subtitle: actionModeLabel,
      active: actionMode !== 'idle',
    },
    {
      id: 'assist',
      label: 'アシスト',
      subtitle: canAssist ? 'パートナー→FILE' : '使用不可',
      disabled: !canAssist,
    },
    {
      id: 'solve-case',
      label: '事件解決 ★勝利',
      subtitle: canSolveCase ? '実行可' : 'まだ',
      disabled: !canSolveCase,
    },
  ];

  return (
    <aside
      className={`actions-panel${interactionLocked ? ' locked' : ''}`}
      aria-label="操作パネル"
      aria-busy={interactionLocked || undefined}
      data-testid="actions-panel-focus-anchor"
      tabIndex={-1}
    >
      <div className="actions-header">ACTIONS</div>

      <ul className="actions-list" role="list">
        {items.map((item) => {
          // 効果解決中ロック: 全項目を disabled 化 (rules/05 割り込み禁止)。active 表示も抑止。
          const disabled = Boolean(item.disabled) || interactionLocked;
          const active = Boolean(item.active) && !interactionLocked;
          const classes = [
            'action-item',
            active && 'active',
            disabled && 'disabled',
          ]
            .filter(Boolean)
            .join(' ');
          const content = (
            <>
              <span className="action-icon" aria-hidden="true" />
              <span className="action-body">
                <span className="action-label">{item.label}</span>
                <span className="action-subtitle">{item.subtitle}</span>
              </span>
            </>
          );
          const activate = () => onActionItemClick?.(item.id as ActionItemId);

          return (
            <li key={item.id}>
              <button
                type="button"
                className={classes}
                data-action-id={item.id}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                onClick={!onActionItemClick ? undefined : activate}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Phase 8.5: actions-list と phase-toggles の間に narrator + log セクションを集約 */}
      <div className="panel-narrator-log">
        {narratorMessage !== undefined && (
          <div className="panel-narrator-text" role="status" data-testid="match-narrator-status">
            {narratorMessage}
          </div>
        )}
        {onLogToggle && (
          <button
            type="button"
            className="panel-log-btn"
            aria-label={logOpen ? 'ログを閉じる' : 'ログを開く'}
            aria-pressed={logOpen}
            onClick={onLogToggle}
          >
            <span className="panel-log-btn-icon" aria-hidden="true">▤</span>
            <span className="panel-log-btn-label">LOG</span>
            <span className="panel-log-btn-count">{logEntryCount}</span>
          </button>
        )}
      </div>

      <div className="phase-toggles" role="group" aria-label="フェイズ">
        {(['auto', 'main', 'end'] as const).map((p) => {
          const isActive = p === currentPhase;
          return (
            <button
              key={p}
              type="button"
              className={`phase-toggle${isActive ? ' active' : ''}`}
              data-phase={p}
              aria-pressed={isActive}
              disabled
            >
              <span className="phase-en">{PHASE_LABEL[p].en}</span>
              <span className="phase-jp">{PHASE_LABEL[p].jp}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="end-turn-btn"
        aria-label="ターン終了"
        disabled={!canEndTurn || interactionLocked}
        onClick={onEndTurn}
      >
        <span className="end-turn-small">END</span>
        <span className="end-turn-big">ターン終了</span>
      </button>
    </aside>
  );
}
