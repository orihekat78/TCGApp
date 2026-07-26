// Phase 8 完全クローズ Commit 3b: MisreadPickerModal (scaffold)
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b
//
// 役割:
//   - 相手が推理したとき、自分の現場の active ミスリード持ちキャラから発動する
//     組合せを user が複数選択できるモーダル (チェックボックス UI)
//   - rules/13: 1 回の推理に対し何枚でも同時発動可能
//
// 注: MVP デッキにミスリード持ちがないため本モーダルは Phase 5 で実カード追加時
//     初めて発動。Commit 3b では scaffold + 単体テストのみ。

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './MisreadPickerModal.css';

export type MisreadCandidateView = {
  uid: string;
  cardId?: string;
  cardName: string;
  x: number;
};

export type MisreadPickerModalProps = {
  open: boolean;
  /** Stable identity of the unresolved decision. */
  decisionKey: string;
  /** 推理側 (= LP-X 対象) の表示名 */
  reasoningName: string;
  /** 推理側の現在 LP (UI でゴール表示用) */
  reasoningLp: number;
  candidates: readonly MisreadCandidateView[];
  onConfirm: (picks: ReadonlyArray<{ uid: string; x: number }>) => void;
  onSkip: () => void;
};

export function MisreadPickerModal(props: MisreadPickerModalProps): JSX.Element | null {
  const { open, decisionKey, reasoningName, reasoningLp, candidates, onConfirm, onSkip } = props;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const expandModal = useCardExpandModal();
  useEffect(() => {
    setSelected(new Set());
  }, [open, decisionKey]);
  if (!open) return null;

  const toggle = (uid: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const totalX = candidates
    .filter((c) => selected.has(c.uid))
    .reduce((sum, c) => sum + c.x, 0);
  const projectedLp = Math.max(0, reasoningLp - totalX);

  return (
    <>
    <div
      className="misread-picker-overlay"
      role="dialog"
      aria-labelledby="misread-picker-title"
      aria-modal="true"
      data-testid="misread-picker-modal"
    >
      <div className="misread-picker-modal">
        <div className="misread-picker-header">
          <h2 id="misread-picker-title">ミスリード!</h2>
          <p className="misread-picker-sub">
            {`${reasoningName} が推理中 (LP ${reasoningLp} → ${projectedLp})`}
          </p>
        </div>
        <div className="misread-picker-body">
          {candidates.length === 0 ? (
            <p className="misread-picker-empty">候補がありません</p>
          ) : (
            <ul className="misread-picker-list">
              {candidates.map((c, index) => (
                <li key={c.uid}>
                  <label
                    className="misread-picker-row"
                    data-testid={`misread-card-${c.uid}`}
                    onContextMenu={c.cardId === undefined ? undefined : (event) => {
                      event.preventDefault();
                      expandModal.open(c.cardId!);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.uid)}
                      onChange={() => toggle(c.uid)}
                      data-testid={`misread-cand-${c.uid}`}
                    />
                    {c.cardId !== undefined && <CardArt cardId={c.cardId} alt={c.cardName} className="misread-card-art" />}
                    <span className="misread-name">{c.cardName}</span>
                    <span className="misread-x">{`LP -${c.x}`}</span>
                  </label>
                  {c.cardId !== undefined && (
                    <button
                      type="button"
                      className="misread-detail"
                      data-testid={`misread-detail-${c.uid}`}
                      aria-label={`${c.cardName}（${index + 1}枚目）の詳細を表示`}
                      onClick={() => expandModal.open(c.cardId!)}
                    >
                      <span aria-hidden="true">🔍</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="misread-picker-actions">
          <button
            type="button"
            className="misread-btn misread-btn-fire"
            onClick={() =>
              onConfirm(
                candidates
                  .filter((c) => selected.has(c.uid))
                  .map((c) => ({ uid: c.uid, x: c.x })),
              )
            }
            data-testid="misread-confirm-btn"
            disabled={selected.size === 0}
          >
            発動する
          </button>
          <button
            type="button"
            className="misread-btn misread-btn-skip"
            onClick={onSkip}
            data-testid="misread-skip-btn"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}
