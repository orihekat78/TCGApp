// Phase 7 Task 7.11 + Phase 8.5 hand expand/collapse:
//   - 自分の手札を MTGA 型フラット並びで表示。
//   - デフォルトはコラプス状態 (小さいストリップ) で他エリアに被らない。
//   - クリックで実寸展開 / × ボタンでコラプスに戻す。
// rules: 05-turn-phases.md §手札の使用 / 12-next-hint.md / 20-color-and-switch.md

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
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
  /**
   * BUG-043 (#8): 個別カード右クリックで CardExpandModal を開く。
   * collapsed / expanded 両方の view で動作。
   */
  onCardExpand?: (cardId: CardId) => void;
  /** 使用可能判定。false なら .disabled。未指定なら全カード使用可。 */
  canUse?: (card: HandCardMeta) => boolean;
  /** 強調表示するカード ID (hover 相当のプロトタイピング用) */
  featuredCardId?: CardId | null;
  /** disabled 時の理由 (title 属性) */
  disabledReason?: (card: HandCardMeta) => string;
  /**
   * Pick mode (User vision: 手札拡大表示から card 選択):
   * true なら全カード cell を pick 対象として click 可能化し onCardClick の代わりに
   * onPickCard(`<cardId>#<idx>`) を発火。expanded view のみ対応。
   */
  pickMode?: boolean;
  /** Pick mode で card 選択時の handler。uid は `<cardId>#<idx>` 形式。 */
  onPickCard?: (uid: string) => void;
  /** Pick mode で skip 可能 (n.min===0、max:N の任意効果) なら true。skip ボタン表示 */
  pickCanSkip?: boolean;
  /** Pick mode で「しない」を選んだとき (= effectPickResolve pickedUid=null) */
  onPickSkip?: () => void;
  /**
   * 2026-05-28 ネクストヒント用に pickMode を汎用化:
   * - pickBannerText: banner 文言 override (default は discard 文言)
   * - pickableCardIds: 指定時はこの cardId のみ pickable (黄色枠+click)、他は dimmed/disabled。
   *   未指定なら全カード pickable (discard 既存挙動)。
   * - pickSkipLabel: skip ボタン文言 override (default「リムーブしない」)
   * - onPickCancel / pickCancelLabel: 指定時 cancel ボタンを追加表示。
   * - pickHideBanner: 2026-05-29 ネクストヒント用 compact モード。banner 文言を隠し、
   *   skip / cancel ボタンを縦並びにする。
   */
  pickBannerText?: string;
  pickableCardIds?: ReadonlySet<string>;
  pickSkipLabel?: string;
  /**
   * BUG-165 UI 側 (wave-10 2026-07-02): nMax > 1 の discard pick (B04005/B07002「手札を2枚リムーブする」)
   * を単発 click 即 dispatch ではなく multi-select (toggle → 完了ボタン) で収集する。
   * CardListModal の pickNMin/pickNMax/onPickMulti と同 contract。
   * pickNMax が無い or 1 の場合は既存 single-pick (onPickCard) 挙動 byte 不変。
   */
  pickNMin?: number;
  pickNMax?: number;
  onPickMulti?: (uids: string[]) => void;
  onPickCancel?: () => void;
  pickCancelLabel?: string;
  pickHideBanner?: boolean;
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
  /** BUG-043 (#8): 右クリックで個別カード拡大表示 (CardExpandModal) */
  onExpand?: (cardId: string) => void;
  /** Pick mode 中の cell: 黄色ハイライト + cursor pointer */
  pickable?: boolean;
  /** BUG-165 UI 側: multi-select pick で選択済み (toggle on) の cell 強調 */
  pickSelected?: boolean;
};

function HandCard({
  card,
  featured,
  disabled,
  disabledTitle,
  onClick,
  onExpand,
  pickable,
  pickSelected,
}: HandCardProps): JSX.Element {
  const classes = [
    'hand-card',
    `color-${card.color}`,
    featured && 'featured',
    disabled && 'disabled',
    onClick && !disabled && 'clickable',
    pickable && 'hand-card--pickable',
    pickSelected && 'hand-card--pick-selected',
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
      title={
        disabled
          ? `${disabledTitle ?? ''}${onExpand ? '\n(右クリック or 🔍 で拡大表示)' : ''}`
          : onExpand
            ? '右クリック or 🔍 で拡大表示'
            : undefined
      }
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onContextMenu={
        onExpand
          ? (e) => {
              e.preventDefault();
              onExpand(card.cardId);
            }
          : undefined
      }
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
      {/* user_request 20260522_01 #9 BUG-056: 虫眼鏡ボタンで拡大表示 (右クリックと並列) */}
      {onExpand && (
        <button
          type="button"
          className="hand-card-magnifier"
          onClick={(e) => {
            e.stopPropagation();
            onExpand(card.cardId);
          }}
          data-testid={`hand-card-magnifier-${card.cardId}`}
          aria-label={`${card.name} を拡大表示`}
          title="拡大表示"
        >
          🔍
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// ミニカード (コラプスモード) — 40×56 程度のチップ
// ------------------------------------------------------------------

function HandMiniCard({
  card,
  onClick,
  onExpand,
  usable = true,
  disabledReason,
}: {
  card: HandCardMeta;
  onClick?: () => void;
  /** BUG-043 (#8): 右クリックで個別カード拡大表示 (CardExpandModal) */
  onExpand?: (cardId: string) => void;
  /** false なら disabled スタイル + click 可だが expand のみ実行 */
  usable?: boolean;
  /** disabled 理由 (FILE 不足 / 色制限 / 1 ターン 1 回使用済) — title 属性に */
  disabledReason?: string;
}): JSX.Element {
  const isEvent = card.type === 'イベント';
  // Round 2: collapsed mini-card にも canUse 判定を反映 (手札 UX 改善)。
  // disabled 時も clickable のまま (expand は許可) だが visual に grey out + title で
  // 理由表示。aria-label にも disabled 状況を含める。
  const ariaLabel = usable
    ? `${card.name} (${card.type}, レベル${card.lv}, コスト${card.cost})`
    : `${card.name} (${card.type}, レベル${card.lv}, コスト${card.cost}) — 使用不可: ${disabledReason ?? '条件未満'}`;
  return (
    <button
      type="button"
      className={`hand-mini-card color-${card.color} ${isEvent ? 'is-event' : 'is-character'}${usable ? '' : ' is-unusable'}`}
      data-card-id={card.cardId}
      data-color={card.color}
      data-type={card.type}
      data-usable={usable ? 'true' : 'false'}
      onClick={onClick}
      onContextMenu={
        onExpand
          ? (e) => {
              e.preventDefault();
              onExpand(card.cardId);
            }
          : undefined
      }
      aria-label={ariaLabel}
      title={
        !usable && disabledReason
          ? `${disabledReason}\n(右クリックで拡大表示)`
          : onExpand
            ? '右クリックで拡大表示'
            : undefined
      }
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
    onCardExpand,
    canUse,
    featuredCardId,
    disabledReason,
    pickMode = false,
    onPickCard,
    pickCanSkip = false,
    onPickSkip,
    pickBannerText,
    pickableCardIds,
    pickSkipLabel,
    onPickCancel,
    pickCancelLabel,
    pickHideBanner = false,
    pickNMin,
    pickNMax,
    onPickMulti,
  } = props;

  // BUG-165 UI 側: multi-select discard pick (nMax>1)。CardListModal isMultiPick と同 contract。
  // hooks は early return (手札0) より前に置く (rules of hooks)。
  const isMultiPick = pickMode && typeof pickNMax === 'number' && pickNMax > 1 && onPickMulti !== undefined;
  const [pickSelected, setPickSelected] = useState<string[]>([]);
  useEffect(() => {
    if (!pickMode) setPickSelected([]);
  }, [pickMode]);
  const togglePickSelected = (uid: string): void => {
    setPickSelected((prev) => {
      if (prev.includes(uid)) return prev.filter((u) => u !== uid);
      if (typeof pickNMax === 'number' && prev.length >= pickNMax) return prev; // 上限ガード
      return [...prev, uid];
    });
  };

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
          {cards.map((c, index) => {
            // Round 2: collapsed view にも canUse 判定を反映。
            // usable=false でも click は許可 (expand 動作のみ — expanded で詳細確認)。
            const usable = canUse ? canUse(c) : true;
            const reason = !usable && disabledReason ? disabledReason(c) : undefined;
            return (
              <HandMiniCard
                key={`${c.cardId}-${index}`}
                card={c}
                onClick={onExpand}
                onExpand={onCardExpand}
                usable={usable}
                disabledReason={reason}
              />
            );
          })}
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
      {pickMode && (
        <div
          className={
            'hand-zone-pick-banner-row' +
            (pickHideBanner ? ' hand-zone-pick-banner-row--vertical' : '')
          }
        >
          {!pickHideBanner && (
            <div className="hand-zone-pick-banner" role="status">
              {pickBannerText ??
                (isMultiPick
                  // BUG-165 UI 側: 枚数を印字テキスト通りに表示 (「2枚リムーブする」= nMin===nMax)
                  ? (pickNMin === pickNMax
                      ? `手札から${pickNMax}枚選んでリムーブしてください`
                      : `手札から${pickNMax}枚まで選んでリムーブしてください`)
                  : '手札から1枚選んでリムーブしてください')}
            </div>
          )}
          {isMultiPick && (
            <button
              type="button"
              className="hand-zone-pick-confirm-btn"
              disabled={pickSelected.length < (pickNMin ?? 0)}
              onClick={() => {
                const uids = pickSelected;
                setPickSelected([]);
                onPickMulti!(uids);
              }}
              data-testid="hand-zone-pick-confirm"
            >
              {`完了 (${pickSelected.length}/${pickNMax}枚)`}
            </button>
          )}
          {/* compact モード (ネクストヒント): 大きい banner ではなく短いヒント caption のみ。
              step2 (黄枠カードをクリックで使用) の操作方法を 1 行で示す。 */}
          {pickHideBanner && pickBannerText && (
            <div className="hand-zone-pick-caption" role="status">
              {pickBannerText}
            </div>
          )}
          {pickCanSkip && onPickSkip && (
            <button
              type="button"
              className="hand-zone-pick-skip-btn"
              onClick={onPickSkip}
              data-testid="hand-zone-pick-skip"
            >
              {pickSkipLabel ?? 'リムーブしない'}
            </button>
          )}
          {onPickCancel && (
            <button
              type="button"
              className="hand-zone-pick-cancel-btn"
              onClick={onPickCancel}
              data-testid="hand-zone-pick-cancel"
            >
              {pickCancelLabel ?? 'キャンセル'}
            </button>
          )}
        </div>
      )}
      <div className="hand-cards-row" onClick={handleRowBackdropClick}>
        {cards.map((c, index) => {
          // Pick mode (User vision): 全 card cell が pick 対象、click → onPickCard
          // (`<cardId>#<idx>` 形式 uid)。onCardClick は suppress。
          // pickable=true で黄色ハイライト + cursor pointer。
          if (pickMode && (onPickCard || isMultiPick)) {
            // 2026-05-28: pickableCardIds 指定時は該当カードのみ pickable (黄色枠+click)。
            // 非該当は disabled (dimmed, click 無効)。未指定なら全 pickable (discard 既存挙動)。
            const canPick = pickableCardIds ? pickableCardIds.has(c.cardId) : true;
            const pickUid = `${c.cardId}#${index}`;
            // BUG-165 UI 側: multi-select は click = toggle (即 dispatch しない)、完了ボタンで確定。
            const isSelected = isMultiPick && pickSelected.includes(pickUid);
            return (
              <HandCard
                key={`${c.cardId}-${index}`}
                card={c}
                featured={false}
                disabled={!canPick}
                disabledTitle={!canPick ? 'レベル / 色制限で使用不可' : undefined}
                onClick={canPick
                  ? () => (isMultiPick ? togglePickSelected(pickUid) : onPickCard!(pickUid))
                  : undefined}
                onExpand={onCardExpand}
                pickable={canPick}
                pickSelected={isSelected}
              />
            );
          }
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
              onExpand={onCardExpand}
            />
          );
        })}
      </div>
    </div>
  );
}

export default HandZone;
