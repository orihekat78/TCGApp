import { useEffect, useMemo, useRef, useState } from 'react';
import { CardArt } from '@/ui/components/CardArt';
import { CARD_POOL } from '../data/cardPool';
import type { DeckRecord } from '../data/types';
import { isPlayable } from '../util/deckBridge';

interface Props {
  decks: DeckRecord[];
  selectedId: string;
  onConfirm: (id: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  radioName?: string;
  returnFocus?: HTMLElement | null;
}

export function HomeDeckSelectorDialog({
  decks,
  selectedId,
  onConfirm,
  onClose,
  title = '使用デッキを選択',
  description = '次の対戦で使用するデッキを選びます',
  confirmLabel = 'このデッキを使用',
  radioName = 'home-active-deck',
  returnFocus,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [draftId, setDraftId] = useState(selectedId);
  const entries = useMemo(() => decks.map((deck) => ({
    deck,
    partner: CARD_POOL.find((card) => card.num === deck.partner),
    incident: CARD_POOL.find((card) => card.num === deck.case),
    playable: isPlayable(deck),
  })), [decks]);
  const draft = entries.find((entry) => entry.deck.id === draftId && entry.playable);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    returnFocusRef.current = returnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dialogRef}
      className="home-deck-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-deck-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="home-deck-dialog-shell">
        <header className="home-deck-dialog-header">
          <div>
            <h2 id="home-deck-dialog-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="home-deck-dialog-close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
        </header>

        <fieldset className="home-deck-dialog-grid">
          <legend className="home-sr-only">使用するデッキ</legend>
          {entries.map(({ deck, partner, incident, playable }) => (
            <label
              key={deck.id}
              className={`home-deck-choice${draftId === deck.id ? ' is-selected' : ''}${playable ? '' : ' is-unavailable'}`}
            >
              <input
                className="home-deck-choice-input"
                type="radio"
                name={radioName}
                value={deck.id}
                checked={draftId === deck.id}
                disabled={!playable}
                onChange={() => setDraftId(deck.id)}
              />
              <span className="home-deck-choice-partner">
                {partner ? <CardArt cardId={partner.num} alt="" /> : <span aria-hidden="true" />}
              </span>
              <span className="home-deck-choice-copy">
                <strong>{deck.name}</strong>
                <span>{partner?.name ?? 'パートナー未設定'}</span>
                <span>{incident?.name ?? '事件未設定'}</span>
                {!playable && <em>調整が必要</em>}
              </span>
              <span className="home-deck-choice-incident">
                {incident ? <CardArt cardId={incident.num} alt="" /> : <span aria-hidden="true" />}
              </span>
            </label>
          ))}
        </fieldset>

        <footer className="home-deck-dialog-footer">
          <p>選択中 <strong>{draft?.deck.name ?? '選択してください'}</strong></p>
          <div>
            <button type="button" className="home-deck-dialog-cancel" onClick={onClose}>キャンセル</button>
            <button
              type="button"
              className="home-deck-dialog-confirm"
              disabled={!draft}
              onClick={() => draft && onConfirm(draft.deck.id)}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
