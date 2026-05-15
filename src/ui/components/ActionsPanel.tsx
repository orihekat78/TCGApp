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
  /** ネクストヒント: 使用可否は呼び出し側で判定済み、FILE 枚数を表示 */
  nextHintFileCount: number;
  nextHintUsed: boolean;
  /** パートナー能力: パートナーが active でなければ disabled */
  partnerActive: boolean;
  /** 宣言能力: 利用可能対象数 */
  declaredTargetCount: number;
  /** 推理: 合計 LP (パートナー + active scene キャラ) */
  reasoningTotalLP: number;
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
  | 'action';

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
    handCount, handUseRemaining,
    nextHintFileCount, nextHintUsed,
    partnerActive,
    declaredTargetCount,
    reasoningTotalLP,
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
      subtitle: `${handCount}枚 / 残${handUseRemaining}回`,
      disabled: handUseRemaining <= 0 || handCount === 0,
    },
    {
      id: 'next-hint',
      label: 'ネクストヒント',
      subtitle: `FILE ${nextHintFileCount}枚`,
      disabled: nextHintUsed || nextHintFileCount === 0,
    },
    {
      id: 'partner-ability',
      label: 'パートナーの能力',
      subtitle: partnerActive ? '使用可' : 'スリープ中',
      disabled: !partnerActive,
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
  ];

  return (
    <aside className="actions-panel" aria-label="操作パネル">
      <div className="actions-header">ACTIONS</div>

      <ul className="actions-list" role="list">
        {items.map((item) => {
          const classes = [
            'action-item',
            item.active && 'active',
            item.disabled && 'disabled',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={item.id}
              className={classes}
              data-action-id={item.id}
              aria-disabled={item.disabled || undefined}
              onClick={
                item.disabled || !onActionItemClick
                  ? undefined
                  : () => onActionItemClick(item.id as ActionItemId)
              }
              style={item.disabled ? undefined : { cursor: 'pointer' }}
            >
              <span className="action-icon" aria-hidden="true" />
              <span className="action-body">
                <span className="action-label">{item.label}</span>
                <span className="action-subtitle">{item.subtitle}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Phase 8.5: actions-list と phase-toggles の間に narrator + log セクションを集約 */}
      <div className="panel-narrator-log">
        {narratorMessage !== undefined && (
          <div className="panel-narrator-text" role="status">
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
        disabled={!canEndTurn}
        onClick={onEndTurn}
      >
        <span className="end-turn-small">END</span>
        <span className="end-turn-big">ターン終了</span>
      </button>
    </aside>
  );
}
