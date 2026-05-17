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
import './FileArea.css';

export type { FileCard };

export type FileAreaProps = {
  cards: FileCard[];
  side: 'self' | 'opp';
  /** アシスト中パートナーの名前/色解決 (任意) */
  resolveCard?: (cardId: string) => ResolvedCardMeta;
  /** 解決編移行に必要な FILE 枚数 (デフォルト 7、rules/01) */
  threshold?: number;
};

// ------------------------------------------------------------------
// 個別 FILE 内アイテム
// ------------------------------------------------------------------

type FileCardItemProps = {
  card: FileCard;
  resolveCard?: (cardId: string) => ResolvedCardMeta;
};

function FileCardItem({ card, resolveCard }: FileCardItemProps): JSX.Element {
  if (card.type === 'card-back') {
    // 通常の裏向き FILE カード — ファイル + 虫眼鏡アイコンは CSS の ::before で描画
    return (
      <div className="card-back" aria-label="FILE card (face-down)">
        <div className="monogram" aria-hidden="true">DC</div>
        <div className="magnifier" aria-hidden="true" />
      </div>
    );
  }

  // アシスト中パートナー — sleep 向き (rotate -90deg) で表向き相当の識別を行う
  const meta = resolveCard ? resolveCard(card.cardId) : null;
  const color = meta?.color ?? 'blue';
  return (
    <div
      className={`card-back assisted-partner sleep color-${color}`}
      data-card-id={card.cardId}
      aria-label="Assisted partner in FILE"
    >
      <div className="partner-stripe" aria-hidden="true" />
      <div className="partner-mark">P</div>
      {meta?.name && <div className="partner-name">{meta.name}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// FileArea 本体
// ------------------------------------------------------------------

export function FileArea(props: FileAreaProps): JSX.Element {
  const { cards, side, resolveCard, threshold = 7 } = props;

  const count = cards.length;
  const progress = Math.min(count, threshold);
  const fillPct = Math.min(100, (count / threshold) * 100);

  // 最前面に立てる代表カード: アシスト中パートナーがあれば末尾の 1 枚を最前面に、
  // なければ通常 card-back を最前面に。
  // FILE はスタック表示なので「個別カードリスト」は描画せず、
  // 最前面 1 枚 + 3 層の shadow + 枚数オーバーレイで表現する。
  const lastAssisted = [...cards].reverse().find(
    (c): c is { type: 'assisted-partner'; cardId: string } =>
      c.type === 'assisted-partner',
  );
  const topCard: FileCard = lastAssisted ?? { type: 'card-back' };

  // 7マス進捗 (上端)
  const cells = Array.from({ length: threshold }, (_, i) => i < progress);

  return (
    <div
      className={`zone file-strip file-area side-${side}`}
      data-side={side}
      data-count={count}
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
