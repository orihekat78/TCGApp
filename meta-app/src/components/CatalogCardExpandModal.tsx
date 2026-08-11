import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import type { CardDef } from '../data/types';
import { CatalogCardArt } from './CatalogCardArt';
import '@/ui/components/CardExpandModal.css';

interface Props {
  card: CardDef | null;
  onClose: () => void;
}

export function CatalogCardExpandModal({ card, onClose }: Props): JSX.Element | null {
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

  useEffect(() => {
    if (!card) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey, { capture: true });
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [card]);

  if (!card) return null;
  const modal = (
    <div
      ref={dialogRef}
      className="card-expand-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`カード拡大表示: ${card.name}`}
      tabIndex={-1}
    >
      <div className="card-expand-modal" onClick={(event) => event.stopPropagation()}>
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
          <CatalogCardArt imagePath={card.imagePath} alt="" />
        </div>
        <div className="card-name">{card.name}</div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return (
    <>
      <span ref={portalAnchorRef} hidden aria-hidden="true" />
      {portalHost ? createPortal(modal, portalHost) : modal}
    </>
  );
}
