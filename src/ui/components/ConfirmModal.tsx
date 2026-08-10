// Phase 8 Task 8.5: ConfirmModal (controlled component)
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
// 設計: 純粋な presentation component。store 購読は親側 (Playmat) が行い、
// current を prop として渡す。SSR/テスト時に renderToString で値を制御しやすい。

import { useEffect, useRef, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ResolvedConfirmRequest } from '@/ui/hooks/useConfirmation.js';
import './ConfirmModal.css';

export type ConfirmModalProps = {
  /** null なら何も描画しない */
  current: ResolvedConfirmRequest | null;
  onAccept: () => void;
  onReject: () => void;
};

export function ConfirmModal({
  current,
  onAccept,
  onReject,
}: ConfirmModalProps): JSX.Element | null {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (current === null) return undefined;

    const previousFocus = document.activeElement;
    acceptRef.current?.focus();

    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [current]);

  if (current === null) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onReject();
      return;
    }

    if (event.key !== 'Tab') return;
    const first = cancelRef.current;
    const last = acceptRef.current;
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className={`confirm-modal confirm-modal--${current.kind}`}>
        <header className="confirm-modal-header">
          <h2 id="confirm-modal-title" className="confirm-modal-title">
            {current.title}
          </h2>
        </header>
        <div className="confirm-modal-body">{current.body}</div>
        <footer className="confirm-modal-footer">
          <button ref={cancelRef} type="button" className="confirm-cancel" onClick={onReject}>
            {current.cancelLabel}
          </button>
          <button ref={acceptRef} type="button" className="confirm-ok" onClick={onAccept}>
            {current.okLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
