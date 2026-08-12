// BUG-136: deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択 modal。
//
// rules: 13-keywords.md (§捜査X「相手の好きな順番でデッキの下に移す」), 26-qa-deck-refresh.md
//
// 役割:
//   - store.pendingDeckReorder を subscribe (atom-handlers.deckToBottomBound が human 所有 & 2 枚以上を
//     底へ移したとき side-channel set → useEngineDispatch drain で本 field に転送)。
//   - 底へ送ったカード群 (公開順) を drag / ▲▼ で並べ替え、確定で deckReorderResolve(order) を dispatch。
//   - 公開順 (初期順) は既に合法な一choice として底に置かれているので「キャンセル」= 初期順で確定。
//   - drag が効かない環境 / Playwright 用に ▲▼ ボタンを併設 (アクセシブル fallback)。
//
// 既存 SouzaReorderModal.css のスタイルを流用 (同じ「デッキ下へ送る順」UI)。

import { useEffect, useState, type JSX } from 'react';
import {
  useGameStateStore,
  type PendingDecisionIdentity,
} from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { publicCardOccurrenceLabel } from '@/ui/services/uidNames.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import './SouzaReorderModal.css';

export function DeckReorderModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingDeckReorder);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  // pending.cardIds をローカルで並べ替え。pending が変わるたび key で再マウントして初期化する。
  return pending && isHumanDecisionOwner(pending.player, spectatorMode)
    ? <DeckReorderModalInner key={`${pending.decisionId ?? 'legacy'}:${pending.cardIds.join('|')}`} pending={pending} />
    : null;
}

type OrderedCard = { cardId: string; occurrenceId: string };

function asOrderedCards(cardIds: readonly string[]): OrderedCard[] {
  return cardIds.map((cardId, index) => ({ cardId, occurrenceId: `${cardId}#${index}` }));
}

function DeckReorderModalInner({
  pending,
}: {
  pending: { cardIds: readonly string[] } & PendingDecisionIdentity;
}): JSX.Element {
  const { cardIds } = pending;
  // order は cardId の配列 (重複カード対応のため index ベースで扱う)。
  const [order, setOrder] = useState<OrderedCard[]>(() => asOrderedCards(cardIds));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const expandModal = useCardExpandModal();
  const dialogRef = useModalFocusTrap({ active: true });
  useEffect(() => {
    setOrder(asOrderedCards(cardIds));
    setDragIdx(null);
  }, [cardIds]);

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  const confirm = (): void => {
    dispatchEngineAction(bindPendingDecision(
      pending,
      { type: 'deckReorderResolve', order: order.map((card) => card.cardId) },
    ));
  };

  return (
    <div
      ref={dialogRef}
      className="souza-overlay"
      role="dialog"
      data-match-modal-registered="true"
      aria-labelledby="deckreorder-title"
      aria-modal="true"
      data-testid="deck-reorder-modal"
    >
      <div className="souza-modal">
        <div className="souza-header">
          <h2 id="deckreorder-title">デッキの下へ送る順</h2>
          <p className="souza-sub">{`${order.length} 枚を好きな順番に並べ替えてデッキの下へ送ります (上が先)`}</p>
        </div>
        <div className="souza-body">
          <ul className="souza-list">
            {order.map((card, i) => (
              <li
                key={card.occurrenceId}
                className="souza-row"
                data-testid={`deck-reorder-row-${i}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                onDragEnd={() => setDragIdx(null)}
              >
                <span className="souza-index">{i + 1}</span>
                <SelectableCardTile
                  cardId={card.cardId}
                  instanceId={card.occurrenceId}
                  occurrenceLabel={publicCardOccurrenceLabel(order.map((item) => item.cardId), card.cardId, i)}
                  onSelect={() => {}}
                  onExpand={expandModal.open}
                />
                <div className="souza-row-controls">
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === 0}
                    data-testid={`deck-reorder-up-${i}`}
                    aria-label="上へ"
                    onClick={() => move(i, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === order.length - 1}
                    data-testid={`deck-reorder-down-${i}`}
                    aria-label="下へ"
                    onClick={() => move(i, i + 1)}
                  >
                    ▼
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="souza-actions">
          <button
            type="button"
            className="souza-btn souza-btn-confirm"
            onClick={confirm}
            data-testid="deck-reorder-confirm-btn"
          >
            この順で確定
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
