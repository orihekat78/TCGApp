// Phase 7 Task 7.11: HandZone
// 自分の手札 (HandCardMeta[]) を MTGA 型フラット並びで表示。
// 操作系 (クリック / ドラッグ / hover) は Phase 8。
// rules: 05-turn-phases.md §手札の使用 / 12-next-hint.md / 20-color-and-switch.md
// 視覚: design-mockups/01-board-mockup.html 1552-1601, CSS 893-985 行
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import type { JSX } from 'react';
import './HandZone.css';

// ------------------------------------------------------------------
// 型
// ------------------------------------------------------------------

export type CardId = string;
export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type CardType = 'キャラ' | 'イベント';

export type HandCardMeta = {
  cardId: CardId;
  name: string;
  color: CardColor;
  type: CardType;
  cost: number;
  ap: number | null;   // イベントは null → "—"
  lp: number | null;   // 同上
  lv: number;
};

export type HandZoneProps = {
  cards: HandCardMeta[];
  /** 使用可能判定。false なら .disabled。未指定なら全カード使用可。 */
  canUse?: (card: HandCardMeta) => boolean;
  /** 強調表示するカード ID (hover 相当のプロトタイピング用) */
  featuredCardId?: CardId | null;
  /** disabled 時の理由 (title 属性) */
  disabledReason?: (card: HandCardMeta) => string;
};

// ------------------------------------------------------------------
// 個別カード
// ------------------------------------------------------------------

type HandCardProps = {
  card: HandCardMeta;
  featured: boolean;
  disabled: boolean;
  disabledTitle?: string;
};

function HandCard({
  card,
  featured,
  disabled,
  disabledTitle,
}: HandCardProps): JSX.Element {
  const classes = [
    'hand-card',
    `color-${card.color}`,
    featured && 'featured',
    disabled && 'disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const apText = card.ap === null ? '—' : String(card.ap);
  const lpText = card.lp === null ? '—' : String(card.lp);

  return (
    <div
      className={classes}
      data-card-id={card.cardId}
      data-color={card.color}
      title={disabled ? disabledTitle : undefined}
      aria-disabled={disabled || undefined}
    >
      <div className="cost">{card.cost}</div>
      <div className="type-badge">{card.type}</div>
      <div className="color-stripe" aria-hidden="true" />
      <div className="art" aria-hidden="true">
        <div className="silhouette" />
      </div>
      <div className="name">{card.name}</div>
      <div className="stats">
        <span className="ap">{apText}</span>
        <span className="lp">{lpText}</span>
        <span className="lv">{card.lv}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// HandZone 本体
// ------------------------------------------------------------------

export function HandZone(props: HandZoneProps): JSX.Element {
  const { cards, canUse, featuredCardId, disabledReason } = props;

  if (cards.length === 0) {
    return (
      <div className="hand-zone hand-zone--empty" aria-label="手札 0 枚">
        <div className="hand-empty-message">手札なし</div>
      </div>
    );
  }

  return (
    <div
      className="hand-zone"
      role="list"
      aria-label={`手札 ${cards.length} 枚`}
      data-count={cards.length}
    >
      {cards.map((c) => {
        const usable = canUse ? canUse(c) : true;
        const isFeatured = featuredCardId === c.cardId;
        const reason = !usable && disabledReason ? disabledReason(c) : undefined;
        return (
          <HandCard
            key={c.cardId}
            card={c}
            featured={isFeatured}
            disabled={!usable}
            disabledTitle={reason}
          />
        );
      })}
    </div>
  );
}

export default HandZone;
