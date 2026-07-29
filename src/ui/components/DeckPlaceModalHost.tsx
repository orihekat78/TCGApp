// mini-wave #5 P2 (2026-07-10): deckPlaceSplitBound「見た各カードを、好きな順番でデッキの上か下に移す」
// (B05047) の振り分け modal。
//
// rules: 26-qa-deck-refresh.md (見ている間はデッキ扱い — await 中カードは deck 元位置)
//
// 役割:
//   - store.pendingDeckPlace を subscribe (atom-handlers.deckPlaceSplitBound が human 所有時に
//     side-channel set → useEngineDispatch drain で本 field に転送)。
//   - 各カードに「上」「下」バケツを割当て (既定 = 上)、▲▼/drag で並べ替え (バケツ内相対順は
//     リスト順から導出)、確定で deckPlaceResolve({top, bottom}) を dispatch。
//   - 全部「上」のまま確定 = 元の順で上へ戻す (恒等、AI 既定と同じ合法 choice)。
//
// DeckReorderModalHost を土台に 2-bucket 割当を追加 (SouzaReorderModal.css 流用)。

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
import './SouzaReorderModal.css';

export function DeckPlaceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingDeckPlace);
  // S2 B01093: gate は選択者 (ownerPlayer) — 対象デッキ所有者 (player) ではない。
  // 「相手デッキの top 1 を公開し、自分が上か下かを選ぶ」で human に modal を出すための座標系是正。
  return pending && pending.ownerPlayer === 'self'
    ? <DeckPlaceModalInner key={`${pending.decisionId ?? 'legacy'}:${pending.cardIds.join('|')}`} pending={pending} />
    : null;
}

type Row = { cardId: string; occurrenceId: string; bucket: 'top' | 'bottom' };

function asRows(cardIds: readonly string[]): Row[] {
  return cardIds.map((cardId, index) => ({ cardId, occurrenceId: `${cardId}#${index}`, bucket: 'top' }));
}

function DeckPlaceModalInner({
  pending,
}: {
  pending: { cardIds: readonly string[] } & PendingDecisionIdentity;
}): JSX.Element {
  const { cardIds } = pending;
  // リスト順 = 各バケツ内の相対順 (top 行同士 / bottom 行同士でリスト上にある方が先)。
  const [rows, setRows] = useState<Row[]>(() => asRows(cardIds));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const expandModal = useCardExpandModal();
  useEffect(() => {
    setRows(asRows(cardIds));
    setDragIdx(null);
  }, [cardIds]);

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= rows.length || from === to) return;
    setRows((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  const setBucket = (i: number, bucket: 'top' | 'bottom'): void => {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, bucket } : r)));
  };

  const confirm = (): void => {
    const top = rows.filter((r) => r.bucket === 'top').map((r) => r.cardId);
    const bottom = rows.filter((r) => r.bucket === 'bottom').map((r) => r.cardId);
    dispatchEngineAction(bindPendingDecision(pending, { type: 'deckPlaceResolve', top, bottom }));
  };

  return (
    <div
      className="souza-overlay"
      role="dialog"
      aria-labelledby="deckplace-title"
      aria-modal="true"
      data-testid="deck-place-modal"
    >
      <div className="souza-modal">
        <div className="souza-header">
          <h2 id="deckplace-title">デッキの上か下へ</h2>
          <p className="souza-sub">{`${rows.length} 枚をそれぞれデッキの上か下に移します (同じ側はリストで上の行が先)`}</p>
        </div>
        <div className="souza-body">
          <ul className="souza-list">
            {rows.map((row, i) => (
              <li
                key={row.occurrenceId}
                className="souza-row"
                data-testid={`deck-place-row-${i}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
                onDragEnd={() => setDragIdx(null)}
              >
                <span className="souza-index">{i + 1}</span>
                <SelectableCardTile
                  cardId={row.cardId}
                  instanceId={row.occurrenceId}
                  occurrenceLabel={publicCardOccurrenceLabel(rows.map((item) => item.cardId), row.cardId, i)}
                  onSelect={() => {}}
                  onExpand={expandModal.open}
                />
                <div className="souza-row-controls">
                  <button
                    type="button"
                    className="souza-arrow"
                    aria-pressed={row.bucket === 'top'}
                    style={row.bucket === 'top' ? { fontWeight: 'bold' } : undefined}
                    data-testid={`deck-place-top-${i}`}
                    onClick={() => setBucket(i, 'top')}
                  >
                    上
                  </button>
                  <button
                    type="button"
                    className="souza-arrow"
                    aria-pressed={row.bucket === 'bottom'}
                    style={row.bucket === 'bottom' ? { fontWeight: 'bold' } : undefined}
                    data-testid={`deck-place-bottom-${i}`}
                    onClick={() => setBucket(i, 'bottom')}
                  >
                    下
                  </button>
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === 0}
                    data-testid={`deck-place-up-${i}`}
                    aria-label="上へ"
                    onClick={() => move(i, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="souza-arrow"
                    disabled={i === rows.length - 1}
                    data-testid={`deck-place-down-${i}`}
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
            data-testid="deck-place-confirm-btn"
          >
            この配置で確定
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
