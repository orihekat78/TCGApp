// Phase 8 完全クローズ Commit 3a: HiramekiPickerModal
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a Hirameki end-to-end
//
// 役割:
//   - 自証拠がアクション[事件]でリムーブされる際、その証拠カードに type:'icon-flash'
//     能力があれば本モーダルを open し、user が「発動する」/「スキップ」を選ぶ
//   - 同 cardId に対する複数 hirameki ability は MVP では最初の 1 つだけ対象

import type { JSX } from 'react';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { CardArt } from './CardArt.js';
import './HiramekiPickerModal.css';

export type HiramekiPickerModalProps = {
  open: boolean;
  /** リムーブされる証拠カードの表示名 (ヘッダ用) */
  cardName: string;
  /** 実際にヒラメキする公開済みカード。未指定時は既存のテキスト表示を維持する。 */
  cardId?: string;
  /** ability 説明文 (例: 「カードを1枚引く」) */
  abilityText: string;
  onFire: () => void;
  onSkip: () => void;
};

export function HiramekiPickerModal(props: HiramekiPickerModalProps): JSX.Element | null {
  const { open, cardId, cardName, abilityText, onFire, onSkip } = props;
  const expandModal = useCardExpandModal();
  if (!open) return null;
  return (
    <div
      className="hirameki-picker-overlay"
      role="dialog"
      data-match-modal-registered="true"
      aria-labelledby="hirameki-picker-title"
      aria-modal="true"
      data-testid="hirameki-picker-modal"
    >
      <div className="hirameki-picker-modal">
        <div className="hirameki-picker-header">
          <h2 id="hirameki-picker-title">ヒラメキ!</h2>
          <p className="hirameki-picker-sub">{`${cardName} の能力を発動できます`}</p>
        </div>
        <div className="hirameki-picker-body">
          {cardId && (
            <div className="hirameki-source-card-row">
              <button
                type="button"
                className="hirameki-source-card"
                data-testid="hirameki-source-card"
                aria-label={`${cardName}の詳細を表示`}
                onClick={() => expandModal.open(cardId)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  expandModal.open(cardId);
                }}
              >
                <CardArt cardId={cardId} alt="" />
                <span>{cardName}</span>
              </button>
              <button
                type="button"
                className="hirameki-source-card-detail"
                data-testid="hirameki-source-card-detail"
                aria-label={`${cardName}の詳細を表示`}
                onClick={() => expandModal.open(cardId)}
              >
                <span aria-hidden="true">🔍</span>
              </button>
            </div>
          )}
          <p className="hirameki-picker-text">{abilityText}</p>
        </div>
        <div className="hirameki-picker-actions">
          <button
            type="button"
            className="hirameki-btn hirameki-btn-fire"
            onClick={onFire}
            data-testid="hirameki-fire-btn"
          >
            発動する
          </button>
          <button
            type="button"
            className="hirameki-btn hirameki-btn-skip"
            onClick={onSkip}
            data-testid="hirameki-skip-btn"
          >
            スキップ
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
