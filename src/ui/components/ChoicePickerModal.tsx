// BUG-108: ChoicePickerModal — 複数 option を持つ choice effect の択一 UI。
//
// rules: 15-abilities-effects.md (「〜するか〜する」= プレイヤー択一)
// spec: SceneSwitchPickerModal と同型 (overlay + list + cancel)
//
// 役割:
//   - D11012 a1「ターン終了時までLP＋1するか / ターン終了時までAP＋2000する」のような
//     複数 option を持つ宣言能力 effect で、どの option を使うかを選択させる。
//   - useChoicePicker store の current を Playmat が subscribe し、open=true で表示。
//   - option クリック → onPick(index) → ctx.dyn.choiceIndex に積まれ resolveEffectPicks が unwrap。

import { useEffect, type JSX } from 'react';
import './ChoicePickerModal.css';

export type ChoiceOptionView = { index: number; label: string };

export type ChoicePickerModalProps = {
  open: boolean;
  /** 発動カード名 (banner 表示用) */
  sourceName: string;
  /** 選択肢一覧 (2 件以上) */
  options: readonly ChoiceOptionView[];
  onPick: (index: number) => void;
  onCancel: () => void;
};

export function ChoicePickerModal(props: ChoicePickerModalProps): JSX.Element | null {
  const { open, sourceName, options, onPick, onCancel } = props;
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="cp-overlay"
      role="dialog"
      aria-labelledby="cp-title"
      aria-modal="true"
      data-testid="choice-picker-modal"
    >
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="cp-title">効果の選択</h2>
          <p className="cp-sub">{`${sourceName}: いずれかの効果を選んでください`}</p>
        </div>
        <div className="cp-body">
          <ul className="cp-list">
            {options.map((o) => (
              <li key={o.index}>
                <button
                  type="button"
                  className="cp-cand"
                  onClick={() => onPick(o.index)}
                  data-testid={`cp-opt-${o.index}`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="cp-actions">
          <button
            type="button"
            className="cp-btn cp-btn-cancel"
            onClick={onCancel}
            data-testid="cp-cancel-btn"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
