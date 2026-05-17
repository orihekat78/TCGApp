// Phase 7 Task 7.10: RemoveArea
// プレイヤーのリムーブエリア (最新カード + 枚数) を静的表示。
// クリック展開モーダルは Phase 8。
// rules: 14-refresh.md (リムーブ 0 でリフレッシュ → 敗北条件)
// 視覚: design-mockups/01-board-mockup.html 1407-1418 (opp) / 1533-1544 (self)

import type { JSX } from 'react';
import type { CardId } from '@/engine/types/game-state.js';
import type { ResolvedCardMeta } from './SceneArea.js';
import { CardArt } from './CardArt.js';
import './RemoveArea.css';

export type RemoveAreaProps = {
  cards: CardId[];
  side: 'self' | 'opp';
  resolveCard: (cardId: string) => ResolvedCardMeta;
};

/**
 * 最新カード (配列末尾) を表向きで小さく表示 + count バッジ。
 * 0 枚なら空表示 (リフレッシュ時の敗北リスク視覚化)。
 */
export function RemoveArea({ cards, side, resolveCard }: RemoveAreaProps): JSX.Element {
  const count = cards.length;
  const top = count > 0 ? cards[count - 1] : null;
  const topMeta = top !== null && top !== undefined ? resolveCard(top) : null;

  return (
    <div className={`zone remove-col remove-zone remove-area side-${side}`}>
      <div className="zone-label">
        <span>リムーブ</span>
        <span className={`count${count === 0 ? ' zero' : ''}`}>{count}</span>
      </div>
      <div className="stack-display">
        {topMeta !== null && top !== null && top !== undefined ? (
          <div
            className={`card color-${topMeta.color}`}
            data-card-id={top}
            aria-label={`最新リムーブ: ${topMeta.name}`}
          >
            <div className="color-stripe" />
            <div className="art">
              <CardArt cardId={top} alt={topMeta.name} />
            </div>
          </div>
        ) : (
          <div className="stack-empty" aria-label="リムーブ空">EMPTY</div>
        )}
      </div>
    </div>
  );
}
