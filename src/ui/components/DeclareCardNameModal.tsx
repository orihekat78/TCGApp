// mega-wave W6 step1 (2026-07-04): DeclareCardNameModal (scaffold)
//
// rules: 15-abilities-effects.md (「カード名を1つ指定し」系効果)
// spec: .tmp/_w6_specs.json synthesis step1 (rows 49/53/999 declareName 統合)
//
// 役割:
//   - declareName verb を含む宣言能力の使用時、プレイヤーが任意のカード名 (自由文字列) を
//     1つ入力するモーダル。確定値は AbilityCostParams.declaredName → ctx.dyn.declaredName へ流れる。
//   - オートコンプリート候補 = 登録済み CardDef 全名 (engine.cards.all() 由来を呼出元が供給)。
//     公式 Q&A: 名前の実在性/曖昧さは対人ルール領域 — engine は無検証、UI 補完で実務担保。
//
// 注: consumer カード (B09112/B09108/B09003/PR105) は card-phase で登場。本 commit は scaffold +
//     単体配線のみ (MisreadPickerModal と同じ先行 scaffold 運用)。配線時に playwright 実機必須
//     (新 UI 部品「型」、CLAUDE.md セルフレビュー要件)。

import type { JSX } from 'react';
import { useState } from 'react';
import './DeclareCardNameModal.css';

export type DeclareCardNameModalProps = {
  open: boolean;
  /** 能力の説明 (カードテキスト該当句) — 何のための宣言かを表示 */
  prompt: string;
  /** オートコンプリート候補 (登録済み CardDef 全名、呼出元が engine.cards.all() から供給) */
  candidateNames: readonly string[];
  onConfirm: (name: string) => void;
  /** 「してもよい」系のみ供給 (未指定なら宣言必須 = 確定のみ) */
  onSkip?: () => void;
};

export function DeclareCardNameModal(props: DeclareCardNameModalProps): JSX.Element | null {
  const { open, prompt, candidateNames, onConfirm, onSkip } = props;
  const [name, setName] = useState('');
  if (!open) return null;

  const trimmed = name.trim();
  const suggestions = trimmed === ''
    ? []
    : candidateNames.filter((n) => n.includes(trimmed)).slice(0, 8);

  return (
    <div
      className="declare-card-name-overlay"
      role="dialog"
      aria-labelledby="declare-card-name-title"
      aria-modal="true"
      data-testid="declare-card-name-modal"
    >
      <div className="declare-card-name-modal">
        <h3 id="declare-card-name-title">カード名を1つ指定してください</h3>
        <p className="declare-card-name-prompt">{prompt}</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="カード名を入力"
          data-testid="declare-card-name-input"
          autoFocus
        />
        {suggestions.length > 0 && (
          <ul className="declare-card-name-suggestions" data-testid="declare-card-name-suggestions">
            {suggestions.map((n) => (
              <li key={n}>
                <button type="button" onClick={() => setName(n)}>{n}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="declare-card-name-actions">
          <button
            type="button"
            disabled={trimmed === ''}
            onClick={() => onConfirm(trimmed)}
            data-testid="declare-card-name-confirm"
          >
            指定する
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} data-testid="declare-card-name-skip">
              指定しない
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
