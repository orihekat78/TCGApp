// user_request 20260522_01 #12 BUG-061: deckRevealUntil 演出 overlay
//
// 役割:
//   - useGameStateStore.pendingDeckReveal を subscribe
//   - revealed カードを 0.5 秒ずつ animation-delay で順次フェード in
//   - 最終 matched (or 末尾) で highlight
//   - revealed.length * 500ms + 800ms 後に auto-dismiss
//
// side-channel-pattern.md 4 点 checklist の (3) UI 側実装

import type { JSX } from 'react';
import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { def as readDef } from '@/engine/read/def.js';
import './DeckRevealOverlay.css';

export function DeckRevealOverlay(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingDeckReveal);
  const setPending = useGameStateStore((s) => s.setPendingDeckReveal);

  useEffect(() => {
    if (!pending) return;
    const totalMs = pending.revealed.length * 500 + 800;
    const t = setTimeout(() => setPending(null), totalMs);
    return () => clearTimeout(t);
  }, [pending, setPending]);

  if (!pending) return null;

  const playerLabel = pending.player === 'self' ? '自分' : '相手';

  return (
    <div className="deck-reveal-overlay" role="status" data-testid="deck-reveal-overlay">
      <div className="deck-reveal-box">
        <div className="deck-reveal-header">{`${playerLabel}のデッキを公開中…`}</div>
        <div className="deck-reveal-list">
          {pending.revealed.map((cardId, idx) => {
            const name = readDef.card(cardId)?.names?.[0] ?? cardId;
            const isMatched = pending.matched === cardId && idx === pending.revealed.length - 1;
            return (
              <div
                key={`${cardId}-${idx}`}
                className={`deck-reveal-card ${isMatched ? 'is-matched' : ''}`}
                style={{ ['--reveal-index' as string]: String(idx) }}
                data-testid={`deck-reveal-card-${idx}`}
              >
                <span className="deck-reveal-card-num">{idx + 1}</span>
                <span className="deck-reveal-card-name">{name}</span>
                {isMatched && <span className="deck-reveal-match-badge">登場!</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
