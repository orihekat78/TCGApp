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

import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useState } from 'react';
import { resolveDeclaredName } from '@/engine/effect/declared-name-domain.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import type { DeclaredNameDomain } from '@/engine/types';
import './DeclareCardNameModal.css';

export type DeclareCardNameModalProps = {
  open: boolean;
  /** 能力の説明 (カードテキスト該当句) — 何のための宣言かを表示 */
  prompt: string;
  /** オートコンプリート候補 (登録済み CardDef 全名、呼出元が engine.cards.all() から供給) */
  candidateNames: readonly string[];
  domain?: DeclaredNameDomain;
  onConfirm: (name: string) => void;
  /** 「してもよい」系のみ供給 (未指定なら宣言必須 = 確定のみ) */
  onSkip?: () => void;
  /** 能力使用全体の取り消し (dispatch 前 = cost 未払い、state 不変)。batch2 配線で追加 */
  onCancel?: () => void;
};

export function DeclareCardNameModal(props: DeclareCardNameModalProps): JSX.Element | null {
  const { open, prompt, candidateNames, domain = 'unrestricted', onConfirm, onSkip, onCancel } = props;
  const [name, setName] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const dialogRef = useModalFocusTrap({
    active: open,
    onEscape: onCancel,
  });
  if (!open) return null;

  const trimmed = name.trim();
  const engineResolvedName = resolveDeclaredName(domain, trimmed);
  const resolvedName = domain === 'unrestricted'
    ? trimmed
    : engineResolvedName !== null && candidateNames.includes(engineResolvedName)
      ? engineResolvedName
      : null;
  const showsCanonicalResolution = domain !== 'unrestricted'
    && resolvedName !== null
    && resolvedName !== trimmed;
  const matchingSuggestions = trimmed === ''
    ? candidateNames
    : candidateNames.filter((candidate) => candidate.includes(trimmed));
  const suggestions = matchingSuggestions.length === 0 && showsCanonicalResolution
    ? [resolvedName]
    : matchingSuggestions;
  const activeName = activeIndex === -1 ? undefined : suggestions[activeIndex];
  const canSubmit = trimmed !== '' && (
    domain === 'unrestricted' || resolvedName !== null
  );
  const domainGuidanceId = 'declare-card-name-domain-guidance';
  const resolutionId = 'declare-card-name-resolution';
  const promptId = 'declare-card-name-prompt';
  const listboxId = 'declare-card-name-options';
  const invalid = domain !== 'unrestricted' && trimmed !== '' && resolvedName === null;
  const describedBy = [
    promptId,
    ...(domain === 'unrestricted' ? [] : [domainGuidanceId]),
    ...(showsCanonicalResolution ? [resolutionId] : []),
  ].join(' ');

  const selectName = (selectedName: string): void => {
    setName(selectedName);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= suggestions.length - 1 ? 0 : current + 1;
        return current <= 0 ? suggestions.length - 1 : current - 1;
      });
      return;
    }
    if (event.key !== 'Enter') return;
    if (activeName !== undefined) {
      event.preventDefault();
      selectName(activeName);
      onConfirm(activeName);
      return;
    }
    if (canSubmit) {
      event.preventDefault();
      onConfirm(domain === 'unrestricted' ? trimmed : resolvedName!);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="declare-card-name-overlay"
      role="dialog"
      data-match-modal-registered="true"
      aria-labelledby="declare-card-name-title"
      aria-modal="true"
      data-testid="declare-card-name-modal"
    >
      <div className="declare-card-name-modal">
        <h3 id="declare-card-name-title">カード名を1つ指定してください</h3>
        <p id={promptId} className="declare-card-name-prompt" data-testid="declare-card-name-prompt">{prompt}</p>
        {domain !== 'unrestricted' && (
          <p
            id={domainGuidanceId}
            className="declare-card-name-domain-guidance"
            data-testid="declare-card-name-domain-guidance"
            role="status"
            aria-live="polite"
          >
            登録済みのキャラクターカード名から選択してください。{candidateNames.length}件を検索・閲覧できます。
          </p>
        )}
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="カード名を入力"
          data-testid="declare-card-name-input"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={suggestions.length > 0}
          aria-activedescendant={activeName === undefined ? undefined : `declare-card-name-option-${activeIndex}`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoFocus
        />
        {showsCanonicalResolution && (
          <p
            id={resolutionId}
            className="declare-card-name-resolution"
            data-testid="declare-card-name-resolution"
            role="status"
            aria-live="polite"
          >
            「{resolvedName}」として確定します。
          </p>
        )}
        {invalid && (
          <p className="declare-card-name-invalid" role="alert">
            登録済みのキャラクターカード名を候補から選択してください。
          </p>
        )}
        <p className="declare-card-name-count" data-testid="declare-card-name-count">
          {suggestions.length}件の候補
        </p>
        <ul
          id={listboxId}
          className="declare-card-name-suggestions"
          data-testid="declare-card-name-suggestions"
          role="listbox"
          aria-label="カード名候補"
        >
          {suggestions.map((n, index) => (
            <li
              key={n}
              id={`declare-card-name-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? 'is-active' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectName(n)}
            >
              {n}
            </li>
          ))}
        </ul>
        <div className="declare-card-name-actions">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(domain === 'unrestricted' ? trimmed : resolvedName!)}
            data-testid="declare-card-name-confirm"
          >
            指定する
          </button>
          {onSkip && (
            <button type="button" onClick={onSkip} data-testid="declare-card-name-skip">
              指定しない
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} data-testid="declare-card-name-cancel">
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
