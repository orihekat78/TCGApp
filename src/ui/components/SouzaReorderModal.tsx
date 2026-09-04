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

import { useEffect, useState, type JSX } from 'react';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { publicCardOccurrenceLabel } from '@/ui/services/uidNames.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
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

type OrderedCard = SouzaCardView & { occurrenceId: string };

function asOrderedCards(cards: readonly SouzaCardView[]): OrderedCard[] {
  return cards.map((card, index) => ({ ...card, occurrenceId: `${card.cardId}#${index}` }));
}

export function SouzaReorderModal(props: SouzaReorderModalProps): JSX.Element | null {
  const { open, deckTop, onConfirm, onCancel } = props;
  const [order, setOrder] = useState<OrderedCard[]>(() => asOrderedCards(deckTop));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const expandModal = useCardExpandModal();
  const dialogRef = useModalFocusTrap({ active: open });
  useEffect(() => {
    setOrder(asOrderedCards(deckTop));
    setDragIdx(null);
  }, [deckTop]);

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((current) => {
      const next = [...current];
      const [card] = next.splice(from, 1);
      next.splice(to, 0, card!);
      return next;
    });
  };

  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      className="souza-overlay"
      role="dialog"
      data-match-modal-registered="true"
      aria-labelledby="souza-title"
      aria-modal="true"
      data-testid="souza-modal"
    >
      <div className="souza-modal">
        <div className="souza-header">
          <h2 id="souza-title">捜査</h2>
          <p className="souza-sub">{`公開された ${order.length} 枚をデッキの下へ送る順に並べてください`}</p>
        </div>
        <div className="souza-body">
          {order.length === 0 ? (
            <p className="souza-empty">公開カードがありません</p>
          ) : (
            <ul className="souza-list">
              {order.map((card, i) => (
                <li
                  key={card.occurrenceId}
                  className="souza-row"
                  data-testid={`souza-row-${i}`}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <span className="souza-index">{i + 1}</span>
                  <SelectableCardTile
                    cardId={card.cardId}
                    instanceId={card.occurrenceId}
                    occurrenceLabel={publicCardOccurrenceLabel(order.map((item) => item.cardId), card.cardId, i)}
                    onExpand={expandModal.open}
                  />
                  <span className="souza-name souza-row-label">{card.name}</span>
                  <div className="souza-row-controls">
                    <button
                      type="button"
                      className="souza-arrow"
                      disabled={i === 0}
                      data-testid={`souza-up-${i}`}
                      aria-label="上へ"
                      onClick={() => move(i, i - 1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="souza-arrow"
                      disabled={i === order.length - 1}
                      data-testid={`souza-down-${i}`}
                      aria-label="下へ"
                      onClick={() => move(i, i + 1)}
                    >
                      ▼
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="souza-actions">
          <button
            type="button"
            className="souza-btn souza-btn-confirm"
            onClick={() => onConfirm(order.map((card) => card.cardId))}
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
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
