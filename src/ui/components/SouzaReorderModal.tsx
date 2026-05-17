// Phase 8 完全クローズ Commit 4: SouzaReorderModal (scaffold)
//
// rules: 13-keywords.md §捜査X
// spec: 計画 — Commit 4
//
// 役割:
//   - 捜査X 発動時、相手が公開されたデッキ上 X 枚を任意順でデッキの下へ送る
//   - 順番は相手にも見せる必要なし (現状はそのままの順で渡す)
//
// 注: MVP デッキ (CT-D08/CT-D11) に 捜査X カードがないため、本モーダルは Phase 5
//     で実カード追加された時点で発動。Commit 4 は scaffold (UI + SSR test) のみ。

import type { JSX } from 'react';
import './SouzaReorderModal.css';

export type SouzaCardView = {
  cardId: string;
  name: string;
};

export type SouzaReorderModalProps = {
  open: boolean;
  /** 公開された X 枚 (初期順) */
  deckTop: readonly SouzaCardView[];
  /** 並び替えた最終順で確定。配列は cardId の順 */
  onConfirm: (orderedIds: readonly string[]) => void;
  onCancel: () => void;
};

export function SouzaReorderModal(props: SouzaReorderModalProps): JSX.Element | null {
  const { open, deckTop, onConfirm, onCancel } = props;
  if (!open) return null;
  return (
    <div
      className="souza-overlay"
      role="dialog"
      aria-labelledby="souza-title"
      aria-modal="true"
      data-testid="souza-modal"
    >
      <div className="souza-modal">
        <div className="souza-header">
          <h2 id="souza-title">捜査</h2>
          <p className="souza-sub">{`公開された ${deckTop.length} 枚をデッキの下へ送る順に並べてください`}</p>
        </div>
        <div className="souza-body">
          {deckTop.length === 0 ? (
            <p className="souza-empty">公開カードがありません</p>
          ) : (
            <ul className="souza-list">
              {deckTop.map((c, i) => (
                <li key={`${c.cardId}-${i}`} className="souza-row" data-testid={`souza-row-${i}`}>
                  <span className="souza-index">{i + 1}</span>
                  <span className="souza-name">{c.name}</span>
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === 0}
                    data-testid={`souza-up-${i}`}
                    aria-label="上へ"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === deckTop.length - 1}
                    data-testid={`souza-down-${i}`}
                    aria-label="下へ"
                  >
                    ▼
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="souza-actions">
          <button
            type="button"
            className="souza-btn souza-btn-confirm"
            onClick={() => onConfirm(deckTop.map((c) => c.cardId))}
            data-testid="souza-confirm-btn"
          >
            この順で確定
          </button>
          <button
            type="button"
            className="souza-btn souza-btn-cancel"
            onClick={onCancel}
            data-testid="souza-cancel-btn"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
