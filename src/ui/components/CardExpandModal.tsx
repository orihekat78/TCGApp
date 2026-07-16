// Round 4l (BUG-001): カード拡大表示モーダル
//
// 仕様:
//   - cardId が指定されたとき表示、null で非表示
//   - backdrop click / ESC キー / × ボタンで close
//   - z-index: 1600 (CardListModal=1500 より前面)
//   - CardArt を full-size 表示 + 名前 caption

import { useEffect, type JSX } from 'react';
import type { CardId } from '@/engine/types';
import { CardArt } from './CardArt.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
import './CardExpandModal.css';

export type CardExpandModalProps = {
  cardId: CardId | null;
  onClose: () => void;
};

export function CardExpandModal({ cardId, onClose }: CardExpandModalProps): JSX.Element | null {
  // ESC キーで close
  useEffect(() => {
    if (!cardId) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return;
      // BUG-231: window capture phase で最前面modalがEscapeを消費する。
      // 下層LogPanel/global shortcutのlistenerへ伝播させず、このmodalだけ閉じる。
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [cardId, onClose]);

  if (!cardId) return null;

  const name = cardIdToDisplayName(cardId) ?? cardId;

  return (
    <div
      className="card-expand-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`カード拡大表示: ${name}`}
    >
      <div className="card-expand-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="card-expand-close"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </button>
        <div className="card-art-wrap">
          <CardArt cardId={cardId} />
        </div>
        <div className="card-name">{name}</div>
      </div>
    </div>
  );
}
