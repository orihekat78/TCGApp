// Phase 7 Task 7.7: DeckArea
// プレイヤーのデッキ枚数を静的表示。
// rules: 14-refresh.md (デッキ 0 → リフレッシュ)
// 視覚: design-mockups/01-board-mockup.html 1380-1392 (opp) / 1506-1518 (self),
//       CSS 652-690 行

import type { JSX } from 'react';
import './DeckArea.css';

export type DeckAreaProps = {
  count: number;
  side: 'self' | 'opp';
};

/**
 * デッキ表示。残量に応じて段差 (layer.l1/l2/l3/top) を出し分ける:
 *   0 枚:    layer なし、"EMPTY" 表示 (リフレッシュ間際)
 *   1 枚:    top のみ
 *   2 枚:    l1 + top
 *   3 枚:    l1 + l2 + top
 *   4 枚以上: l1 + l2 + l3 + top
 *
 * count バッジは常に表示 (0 でも 0 と表示)。
 */
export function DeckArea({ count, side }: DeckAreaProps): JSX.Element {
  const showL1   = count >= 2;
  const showL2   = count >= 3;
  const showL3   = count >= 4;
  const showTop  = count >= 1;

  // Phase 9-E: count 1〜2 で低残量警告 (rules/14 リフレッシュ間近の視覚化)
  const isLowStock = count > 0 && count <= 2;
  const rootClass = `zone deck-col deck-zone deck-area side-${side}${isLowStock ? ' low-stock' : ''}`;

  return (
    <div className={rootClass}>
      <div className="zone-label"><span>デッキ</span></div>
      <div className="deck-display">
        <div className="deck-stack" data-count={count}>
          {showL3  && <div className="layer l3" aria-hidden="true" />}
          {showL2  && <div className="layer l2" aria-hidden="true" />}
          {showL1  && <div className="layer l1" aria-hidden="true" />}
          {showTop && (
            <div className="layer top" aria-hidden="true">
              <div className="monogram">DC</div>
            </div>
          )}
          {count === 0 && (
            <div className="deck-empty" aria-label="デッキ空">EMPTY</div>
          )}
          <div className="deck-count">{count}</div>
        </div>
      </div>
    </div>
  );
}
