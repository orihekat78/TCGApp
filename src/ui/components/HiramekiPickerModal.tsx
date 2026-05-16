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
import './HiramekiPickerModal.css';

export type HiramekiPickerModalProps = {
  open: boolean;
  /** リムーブされる証拠カードの表示名 (ヘッダ用) */
  cardName: string;
  /** ability 説明文 (例: 「カードを1枚引く」) */
  abilityText: string;
  onFire: () => void;
  onSkip: () => void;
};

export function HiramekiPickerModal(props: HiramekiPickerModalProps): JSX.Element | null {
  const { open, cardName, abilityText, onFire, onSkip } = props;
  if (!open) return null;
  return (
    <div
      className="hirameki-picker-overlay"
      role="dialog"
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
    </div>
  );
}
