// Phase 8 Task 8.5: ConfirmModal (controlled component)
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
// 設計: 純粋な presentation component。store 購読は親側 (Playmat) が行い、
// current を prop として渡す。SSR/テスト時に renderToString で値を制御しやすい。

import type { JSX } from 'react';
import type { ResolvedConfirmRequest } from '@/ui/hooks/useConfirmation.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
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
  const dialogRef = useModalFocusTrap({
    active: current !== null,
    initialFocusSelector: '.confirm-ok',
    onEscape: onReject,
  });

  if (current === null) return null;

  return (
    <div
      ref={dialogRef}
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className={`confirm-modal confirm-modal--${current.kind}`}>
        <header className="confirm-modal-header">
          <h2 id="confirm-modal-title" className="confirm-modal-title">
            {current.title}
          </h2>
        </header>
        <div className="confirm-modal-body">{current.body}</div>
        <footer className="confirm-modal-footer">
          <button type="button" className="confirm-cancel" onClick={onReject}>
            {current.cancelLabel}
          </button>
          <button type="button" className="confirm-ok" onClick={onAccept}>
            {current.okLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
