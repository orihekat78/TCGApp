// Round 4l (BUG-001): カード拡大表示モーダル
//
// 仕様:
//   - cardId が指定されたとき表示、null で非表示
//   - backdrop click / ESC キー / × ボタンで close
//   - 呼び出し元の stacking context を避けるため React root 直下へ portal
//   - CardArt を full-size 表示 + 名前 caption

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import type { CardId } from '@/engine/types';
import { CardArt } from './CardArt.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
import './CardExpandModal.css';

export type CardExpandModalProps = {
  cardId: CardId | null;
  onClose: () => void;
};

export function CardExpandModal({ cardId, onClose }: CardExpandModalProps): JSX.Element | null {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const portalAnchorRef = useCallback((anchor: HTMLSpanElement | null): void => {
    if (!anchor || typeof document === 'undefined') return;
    let host = anchor.parentElement;
    while (host?.parentElement && host.parentElement !== document.body) {
      host = host.parentElement;
    }
    setPortalHost(host ?? document.body);
  }, []);

  // ESC / Tab / focus return を最前面の拡大モーダルだけで処理する。
  useEffect(() => {
    if (!cardId) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        // BUG-231: window capture phase で最前面modalがEscapeを消費する。
        // 下層LogPanel/global shortcutのlistenerへ伝播させず、このmodalだけ閉じる。
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey, { capture: true });
      const target = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, [cardId]);

  if (!cardId) return null;

  const name = cardIdToDisplayName(cardId) ?? cardId;

  const modal = (
    <div
      ref={dialogRef}
      className="card-expand-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`カード拡大表示: ${name}`}
      tabIndex={-1}
    >
      <div className="card-expand-modal" onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
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

  // SSR cannot establish a portal host, so it emits static nested markup.
  // The app mounts with createRoot; interactive browser renders take the portal path.
  if (typeof document === 'undefined') return modal;

  return (
    <>
      <span ref={portalAnchorRef} hidden aria-hidden="true" />
      {portalHost ? createPortal(modal, portalHost) : modal}
    </>
  );
}
