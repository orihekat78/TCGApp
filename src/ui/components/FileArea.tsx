// Phase 7 Task 7.8: FileArea
// FILE エリア (毎ターン自動的に置かれる横向きカードのスタック + 7枚進捗バー +
// アシスト中パートナー混在) を静的表示。
// 操作系 (クリック → モーダル展開) は Phase 8。
// rules: 13-keywords.md §アシスト, 01-victory-conditions.md (FILE 7 で解決編移行)
// 視覚: design-mockups/01-board-mockup.html 1394-1405 (opp) / 1520-1531 (self),
//       CSS 700-748 行 + 587-650 行
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import type { JSX } from 'react';
// engine の FileCard 型をそのまま使用 (内部表現と完全一致)
import type { FileCard } from '@/engine/types/game-state.js';
import type { ResolvedCardMeta } from './SceneArea.js';
import { CardArt } from './CardArt.js';
import './FileArea.css';

export type { FileCard };

export type FileAreaProps = {
  cards: FileCard[];
  side: 'self' | 'opp';
  /** アシスト中パートナーの名前/色解決 (任意) */
  resolveCard?: (cardId: string) => ResolvedCardMeta;
  /** 解決編移行に必要な FILE 枚数 (デフォルト 7、rules/01) */
  threshold?: number;
  /** Round 2: エリアクリックで内容モーダルを開く callback */
  onClick?: () => void;
  /**
   * 2026-05-30 user_request: ネクストヒント step1 で引く予定の枚数 (表示プレビュー)。
   * ネクストヒントは「引いてから出す」ため、ピッカー表示中は引いた分を先取りして
   * 表示枚数を -pendingDrawn する (実効 FILE 枚数 = step2 のレベル上限と一致させ誤解を防ぐ)。
   * engine state は不変 (atomic 確定時に実際に減る)。
   */
  pendingDrawn?: number;
};

// ------------------------------------------------------------------
// 個別 FILE 内アイテム
// ------------------------------------------------------------------

type FileCardItemProps = {
  card: FileCard;
  resolveCard?: (cardId: string) => ResolvedCardMeta;
};

function FileCardItem({ card, resolveCard }: FileCardItemProps): JSX.Element {
  if (card.type === 'card-back' && card.faceUp === true) {
    const meta = resolveCard?.(card.cardId);
    return (
      <div className="file-card-faceup" data-card-id={card.cardId} aria-label={`FILE card ${meta?.name ?? card.cardId}`}>
        <div className="file-card-faceup-name">{meta?.name ?? card.cardId}</div>
        <div className="file-card-faceup-id">{card.cardId}</div>
      </div>
    );
  }
  if (card.type === 'card-back') {
    // 通常の裏向き FILE カード — ファイル + 虫眼鏡アイコンは CSS の ::before で描画
    return (
      <div className="card-back" aria-label="FILE card (face-down)">
        <div className="monogram" aria-hidden="true">DC</div>
        <div className="magnifier" aria-hidden="true" />
      </div>
    );
  }

  const meta = resolveCard?.(card.cardId);
  return (
    <div
      className={`file-card-faceup assisted-partner color-${meta?.color ?? 'blue'}`}
      data-card-id={card.cardId}
      aria-label={`FILE partner ${meta?.name ?? card.cardId}`}
    >
      <CardArt
        cardId={card.cardId}
        alt={meta?.name ?? card.cardId}
        className="assisted-partner-art"
      />
    </div>
  );
}

// ------------------------------------------------------------------
// FileArea 本体
// ------------------------------------------------------------------

export function FileArea(props: FileAreaProps): JSX.Element {
  const { cards, side, threshold = 7, onClick, pendingDrawn = 0, resolveCard } = props;

  // 2026-05-30: ネクストヒントで引く予定の分を先取りして表示 (実効枚数)。
  const count = Math.max(0, cards.length - pendingDrawn);
  const progress = Math.min(count, threshold);
  const fillPct = Math.min(100, (count / threshold) * 100);

  // 最前面に立てる代表カード: アシスト中パートナーがあれば末尾の 1 枚を最前面に、
  // なければ通常 card-back を最前面に。
  // FILE はスタック表示なので「個別カードリスト」は描画せず、
  // 最前面 1 枚 + 3 層の shadow + 枚数オーバーレイで表現する。
  const lastFaceUp = [...cards].reverse().find(
    (c): c is { type: 'card-back'; cardId: string; faceUp: true } =>
      c.type === 'card-back' && c.faceUp === true,
  );
  const lastAssisted = [...cards].reverse().find(
    (c): c is { type: 'assisted-partner'; cardId: string } =>
      c.type === 'assisted-partner',
  );
  // Round 3: card-back に cardId 必須 → display 用 placeholder で fallback
  // (実際には cards[topIdx] を使うべきだが、UI は表向き要素を出さないため値は任意)
  const lastCardBack = [...cards].reverse().find(
    (c): c is { type: 'card-back'; cardId: string } =>
      c.type === 'card-back',
  );
  const topCard: FileCard = lastAssisted ?? lastFaceUp ?? lastCardBack ?? { type: 'card-back', cardId: '' };

  // 7マス進捗 (上端)
  const cells = Array.from({ length: threshold }, (_, i) => i < progress);

  return (
    <div
      className={`zone file-strip file-area side-${side}${onClick ? ' clickable' : ''}`}
      data-side={side}
      data-count={count}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${side === 'self' ? '自分の' : '相手の'}FILE エリアを開く (${count} 枚)` : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {/* 7マス進捗 + ラベル */}
      <div className="file-strip-header">
        <span>FILE</span>
        <div
          className={`progress-7${count >= threshold ? ' complete' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-valuenow={progress}
        >
          {cells.map((on, i) => (
            <span key={i} className={on ? 'filled' : ''} />
          ))}
        </div>
      </div>

      {/* zone-label (mock 互換 — file-strip-header と兼用する場合に備えて残す) */}
      <div className="zone-label">
        <span>FILE</span>
        <span className="count">{count}</span>
      </div>

      {/* スタック表示 */}
      <div className="stack-display file">
        <div className="stack-shadow s3" aria-hidden="true" />
        <div className="stack-shadow s2" aria-hidden="true" />
        <div className="stack-shadow s1" aria-hidden="true" />
        {count > 0 ? (
          <FileCardItem card={topCard} resolveCard={resolveCard} />
        ) : (
          // 0 枚時は影だけ残し card-back は描かない (空気感)
          <div className="card-back empty" aria-label="FILE empty" />
        )}
        <div className="count-overlay">{count}</div>
      </div>

      {/* 連続ストライプ進捗 */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

export default FileArea;
