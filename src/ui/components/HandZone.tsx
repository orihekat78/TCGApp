// Phase 7 Task 7.11 + Phase 8.5 hand expand/collapse:
//   - 自分の手札を MTGA 型フラット並びで表示。
//   - デフォルトはコラプス状態 (小さいストリップ) で他エリアに被らない。
//   - クリックで実寸展開 / × ボタンでコラプスに戻す。
// rules: 05-turn-phases.md §手札の使用 / 12-next-hint.md / 20-color-and-switch.md

import type { JSX } from 'react';
import { CardArt } from './CardArt.js';
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
  /** true: 実寸カード + × 閉じるボタン。false (default): 縮小ストリップ。 */
  expanded?: boolean;
  /** コラプス状態のミニカードがクリックされたとき */
  onExpand?: () => void;
  /** 展開状態の × がクリックされたとき */
  onCollapse?: () => void;
  /** 個別カードクリック (展開状態のみ反応)。Phase 8.6+ で手札使用フロー配線。 */
  onCardClick?: (cardId: CardId) => void;
  /** 使用可能判定。false なら .disabled。未指定なら全カード使用可。 */
  canUse?: (card: HandCardMeta) => boolean;
  /** 強調表示するカード ID (hover 相当のプロトタイピング用) */
  featuredCardId?: CardId | null;
  /** disabled 時の理由 (title 属性) */
  disabledReason?: (card: HandCardMeta) => string;
};

// ------------------------------------------------------------------
// 個別カード (展開モード)
// ------------------------------------------------------------------

type HandCardProps = {
  card: HandCardMeta;
  featured: boolean;
  disabled: boolean;
  disabledTitle?: string;
  onClick?: () => void;
};

function HandCard({
  card,
  featured,
  disabled,
  disabledTitle,
  onClick,
}: HandCardProps): JSX.Element {
  const classes = [
    'hand-card',
    `color-${card.color}`,
    featured && 'featured',
    disabled && 'disabled',
    onClick && !disabled && 'clickable',
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
      onClick={disabled ? undefined : onClick}
    >
      <div className="cost">{card.cost}</div>
      <div className="type-badge">{card.type}</div>
      <div className="color-stripe" aria-hidden="true" />
      <div className="art" aria-hidden="true">
        <CardArt cardId={card.cardId} alt={card.name} />
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
// ミニカード (コラプスモード) — 40×56 程度のチップ
// ------------------------------------------------------------------

function HandMiniCard({
  card,
  onClick,
}: {
  card: HandCardMeta;
  onClick?: () => void;
}): JSX.Element {
  const isEvent = card.type === 'イベント';
  return (
    <button
      type="button"
      className={`hand-mini-card color-${card.color} ${isEvent ? 'is-event' : 'is-character'}`}
      data-card-id={card.cardId}
      data-color={card.color}
      data-type={card.type}
      onClick={onClick}
      aria-label={`${card.name} (${card.type}, レベル${card.lv}, コスト${card.cost})`}
    >
      <span className="hand-mini-cost" aria-hidden="true">{card.cost}</span>
      <span className="hand-mini-type-badge" aria-hidden="true">
        {isEvent ? 'EV' : 'CH'}
      </span>
      <span className="hand-mini-art" aria-hidden="true">
        <CardArt cardId={card.cardId} alt={card.name} />
      </span>
      <span className="hand-mini-name">{card.name}</span>
    </button>
  );
}

// ------------------------------------------------------------------
// HandZone 本体
// ------------------------------------------------------------------

export function HandZone(props: HandZoneProps): JSX.Element {
  const {
    cards,
    expanded = false,
    onExpand,
    onCollapse,
    onCardClick,
    canUse,
    featuredCardId,
    disabledReason,
  } = props;

  if (cards.length === 0) {
    return (
      <div className="hand-zone hand-zone--empty" aria-label="手札 0 枚">
        <div className="hand-empty-message">手札なし</div>
      </div>
    );
  }

  // コラプスモード: 小さいチップを横並びで配置。各チップクリックで展開。
  if (!expanded) {
    return (
      <div
        className="hand-zone hand-zone--collapsed"
        aria-label={`手札 ${cards.length} 枚 (クリックで拡大)`}
        data-count={cards.length}
      >
        <div className="hand-mini-strip" role="list">
          {cards.map((c, index) => (
            <HandMiniCard key={`${c.cardId}-${index}`} card={c} onClick={onExpand} />
          ))}
        </div>
      </div>
    );
  }

  // 展開モード: 実寸カード + × 閉じるボタン + 空白クリックでも閉じる
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    // クリックがコンテナ本体 (背景) なら閉じる。カード/ボタンの onClick は stopPropagation 不要 (target が異なる)。
    if (e.target === e.currentTarget && onCollapse) onCollapse();
  };
  const handleRowBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && onCollapse) onCollapse();
  };
  return (
    <div
      className="hand-zone hand-zone--expanded"
      role="list"
      aria-label={`手札 ${cards.length} 枚`}
      data-count={cards.length}
      onClick={handleBackdropClick}
    >
      {onCollapse && (
        <button
          type="button"
          className="hand-close-btn"
          aria-label="手札を閉じる"
          onClick={onCollapse}
        >
          ×
        </button>
      )}
      <div className="hand-cards-row" onClick={handleRowBackdropClick}>
        {cards.map((c, index) => {
          const usable = canUse ? canUse(c) : true;
          const isFeatured = featuredCardId === c.cardId;
          const reason = !usable && disabledReason ? disabledReason(c) : undefined;
          return (
            <HandCard
              key={`${c.cardId}-${index}`}
              card={c}
              featured={isFeatured}
              disabled={!usable}
              disabledTitle={reason}
              onClick={onCardClick ? () => onCardClick(c.cardId) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export default HandZone;
