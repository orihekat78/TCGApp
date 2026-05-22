// Round 2 — FILE / 証拠 / リムーブ エリアの内容を確認するモーダル
//
// ユーザ指摘: 「ファイルエリア・証拠エリア・リムーブエリアを押して内容が見れない」
// spec: .claude/specs/2026-05-11-ui-modal-flows-other.md
//
// 設計:
//   - 共通の CardListModal で 3 種すべて描画
//   - 証拠は rules/10 (裏向き) と rules/10 §ヒラメキ 表向き混在に対応
//     → MVP では 「○ 枚 (内容非公開)」 の summary のみ。詳細は将来。
//   - FILE は裏向き (ヒラメキ確認のための覗き見はルール違反) なので枚数 + 区別のみ
//   - リムーブは表向きなので cardId / 名前を CardArt + cardIdToDisplayName で描画
//   - Esc / 背景 click / × ボタンで閉じる

import { useEffect, type JSX } from 'react';
import type { CardId } from '@/engine/types';
import { CardArt } from './CardArt.js';
import { cardIdToDisplayName, cardIdToPrintedNumber } from '@/ui/services/uidNames.js';
import './CardListModal.css';

export type CardListKind = 'file' | 'evidence' | 'remove';

const TITLE: Record<CardListKind, string> = {
  file:     'FILE エリア',
  evidence: '証拠エリア',
  remove:   'リムーブエリア',
};

const HINT: Record<CardListKind, string> = {
  file:     'デッキ上から裏向きで配置されたカード (rules/05 オートフェイズ)。アシスト中パートナーが含まれる場合があります。',
  evidence: '推理やアクション[事件] で集めた証拠カード (裏向き)。ヒラメキ付きが含まれる可能性があります。',
  remove:   '使用済イベント / リムーブされたキャラ。リフレッシュでデッキに戻る対象 (rules/14)。',
};

export type CardListModalProps = {
  /** null なら非表示。null 以外なら該当種別を表示。 */
  kind: CardListKind | null;
  /** 表示対象のプレイヤー ('自分の…' / '相手の…') */
  side: 'self' | 'opp';
  /** 表向きの cardId 配列 (リムーブエリア等)。裏向き only の場合は []。 */
  cards: ReadonlyArray<CardId>;
  /** 裏向きカードの枚数 (FILE / 証拠 など)。表向きカードと合わせて合計枚数を表示。 */
  faceDownCount?: number;
  /** 閉じる callback */
  onClose: () => void;
  /**
   * user_request 20260522_01 #11 BUG-057: 個別カードをクリック → 拡大表示。
   * 未指定なら item は静的表示 (旧挙動)。
   */
  onExpand?: (cardId: CardId) => void;
};

export function CardListModal(props: CardListModalProps): JSX.Element | null {
  const { kind, side, cards, faceDownCount = 0, onClose, onExpand } = props;

  // Esc で閉じる (本 modal のみ scope。global keymap には影響しない)
  useEffect(() => {
    if (kind === null) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kind, onClose]);

  if (kind === null) return null;

  const sideLabel = side === 'self' ? '自分の' : '相手の';
  const total = cards.length + faceDownCount;

  return (
    <div
      className="card-list-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-list-modal-title"
      onClick={onClose}
    >
      <div
        className="card-list-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="card-list-modal-header">
          <div className="card-list-modal-titles">
            <h2 id="card-list-modal-title">
              {sideLabel}{TITLE[kind]} ({total} 枚)
            </h2>
            <p className="card-list-modal-hint">{HINT[kind]}</p>
          </div>
          <button
            type="button"
            className="card-list-modal-close"
            aria-label="閉じる"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="card-list-modal-body">
          {total === 0 ? (
            <div className="card-list-modal-empty">なし</div>
          ) : (
            <div className="card-list-modal-grid">
              {/* 表向きカード (リムーブエリア等で公開されているもの) */}
              {/* user_request 20260522_01 #11 BUG-057: onExpand 指定時はクリック
                  可能 (button 化) で個別カード拡大表示。未指定なら従来通り div */}
              {cards.map((cardId, idx) => {
                const itemContent = (
                  <>
                    <CardArt
                      cardId={cardId}
                      alt={cardIdToDisplayName(cardId)}
                      className="card-list-item-art"
                    />
                    <div className="card-list-item-name">
                      {cardIdToDisplayName(cardId)}
                    </div>
                    <div className="card-list-item-id">
                      No.{cardIdToPrintedNumber(cardId)}
                    </div>
                  </>
                );
                return onExpand ? (
                  <button
                    type="button"
                    key={`face-${cardId}-${idx}`}
                    className="card-list-item card-list-item--clickable"
                    onClick={() => onExpand(cardId)}
                    data-testid={`card-list-item-${cardId}-${idx}`}
                    aria-label={`${cardIdToDisplayName(cardId)} を拡大表示`}
                  >
                    {itemContent}
                  </button>
                ) : (
                  <div key={`face-${cardId}-${idx}`} className="card-list-item">
                    {itemContent}
                  </div>
                );
              })}
              {/* 裏向きカード (FILE / 証拠 など、内容非公開) */}
              {Array.from({ length: faceDownCount }).map((_, idx) => (
                <div key={`back-${idx}`} className="card-list-item face-down">
                  <div className="card-list-item-back" aria-label="裏向きカード">
                    <svg viewBox="0 0 24 24" width="32" height="32">
                      <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                      <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="card-list-item-name">非公開</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CardListModal;
