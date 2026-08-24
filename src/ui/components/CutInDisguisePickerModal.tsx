// Phase 8.6β: CutInDisguisePickerModal
//
// rules: 09-cutin-disguise.md / 23-qa-disguise-cutin.md
// spec: .claude/specs/2026-05-11-ui-modal-flows-contact.md
//
// 役割:
//   - コンタクト中、自分が cutin or disguise を選ぶモーダル
//   - 候補は手札を「カットイン可」「変装可」でフィルタしたもの (engine.flow.contact.canCutIn / canDisguise で算出済の想定)
//   - 「パス」は常に選択可
//   - 1 コンタクトにつき 1 枚 (rules/09) は親側で制御 (cutInUsed フラグ)

import type { JSX } from 'react';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './CutInDisguisePickerModal.css';

export type CutInDisguiseCandidate = {
  /** Stable area-qualified hand occurrence UID; optional only for UI fixture compatibility. */
  uid?: string;
  cardId: string;
  name: string;
  /** 'cutin' | 'disguise' */
  kind: 'cutin' | 'disguise';
};

export type CutInDisguiseHandCard = {
  uid: string;
  cardId: string;
  name: string;
};

export type CutInDisguisePickerModalProps = {
  open: boolean;
  /** どちらの行動順か (header 表示用) */
  actorLabel: '1番目' | '2番目' | '1番目 (再行動)';
  /** user_request 20260522_01 #7 (BUG-055): actor の カード名 (optional) */
  actorName?: string;
  /** 候補カード (cutin と disguise が混在) */
  candidates: readonly CutInDisguiseCandidate[];
  /** Full hand, including prohibited and otherwise noneligible cards. */
  handCards?: readonly CutInDisguiseHandCard[];
  /** Preferred occurrence after a nested name prompt closes. */
  initialFocusOccurrenceUid?: string;
  onPickCutIn: (cardId: string, occurrenceUid: string) => void;
  onPickDisguise: (cardId: string) => void;
  onPass: () => void;
};

export function CutInDisguisePickerModal(props: CutInDisguisePickerModalProps): JSX.Element | null {
  const {
    open,
    actorLabel,
    actorName,
    candidates,
    handCards,
    initialFocusOccurrenceUid,
    onPickCutIn,
    onPickDisguise,
    onPass,
  } = props;
  const expandModal = useCardExpandModal();
  const escapedInitialFocusUid = initialFocusOccurrenceUid
    ?.replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
  const dialogRef = useModalFocusTrap({
    active: open,
    initialFocusSelector: escapedInitialFocusUid === undefined
      ? '[data-cid-primary-action="true"]'
      : `[data-cid-occurrence="${escapedInitialFocusUid}"]`,
  });
  if (!open) return null;

  const cutins = candidates.filter((c) => c.kind === 'cutin');
  const disgs = candidates.filter((c) => c.kind === 'disguise');
  // user_request 20260522_01 #7 (BUG-055): 「1番目 (江戸川コナン): ...」と
  // カード名を含めて表示
  const actorDisplay = actorName ? `${actorLabel} (${actorName})` : actorLabel;

  return (
    <div
      ref={dialogRef}
      className="cid-overlay"
      role="dialog"
      aria-labelledby="cid-title"
      aria-modal="true"
      tabIndex={-1}
      data-testid="cid-picker-modal"
    >
      <div className="cid-modal">
        <div className="cid-header">
          <h2 id="cid-title">コンタクト行動</h2>
          <p className="cid-sub" data-testid="cid-actor-label">{`${actorDisplay}: カットイン / 変装 を選択`}</p>
        </div>

        <div className="cid-body">
        {handCards !== undefined && (
          <section className="cid-hand-preview" aria-label="手札一覧">
            <h3>手札（黄色枠のみ使用可能）</h3>
            <div className="cid-hand-list">
              {handCards.map((card, index) => {
                const actions = candidates.filter((candidate) =>
                  candidate.uid !== undefined
                    ? candidate.uid === card.uid
                    : candidate.cardId === card.cardId,
                );
                const eligible = actions.length > 0;
                return (
                  <div
                    key={card.uid}
                    className={`cid-hand-card${eligible ? ' is-eligible' : ''}`}
                    data-testid={`cid-hand-card-${card.uid}`}
                  >
                    <button
                      type="button"
                      className="cid-hand-expand"
                      onClick={() => expandModal.open(card.cardId)}
                      data-testid={`cid-hand-expand-${card.uid}`}
                      aria-label={`${card.name}（${index + 1}枚目）の詳細を表示`}
                    >
                      <CardArt cardId={card.cardId} alt={card.name} className="cid-hand-art" />
                      <span>{card.name}</span>
                    </button>
                    <div className="cid-hand-badges" aria-label="使用可能な行動">
                      {actions.some((candidate) => candidate.kind === 'cutin') && <span>カットイン</span>}
                      {actions.some((candidate) => candidate.kind === 'disguise') && <span>変装</span>}
                      {!eligible && <span className="is-disabled">使用不可</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="cid-choice-grid">
          <section className="cid-section">
            <h3>カットイン</h3>
            {cutins.length === 0 ? (
              <p className="cid-empty">使用可能なカードなし</p>
            ) : (
              <ul className="cid-list">
                {cutins.map((c, index) => {
                  const occurrenceId = c.uid ?? `${c.cardId}#${index}`;
                  return (
                  <li key={`cutin-${occurrenceId}`}>
                    <button
                      type="button"
                      className="cid-cand cid-cand-cutin"
                      data-cid-primary-action="true"
                      data-cid-occurrence={occurrenceId}
                      onClick={() => onPickCutIn(c.cardId, occurrenceId)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        expandModal.open(c.cardId);
                      }}
                      data-testid={`cid-cutin-${occurrenceId}`}
                    >
                      <CardArt cardId={c.cardId} alt={c.name} className="cid-cand-art" />
                      {c.name}
                    </button>
                    <button
                      type="button"
                      className="cid-cand-detail"
                      data-testid={`cid-cutin-detail-${occurrenceId}`}
                      aria-label={`${c.name}（${index + 1}枚目）の詳細を表示`}
                      onClick={() => expandModal.open(c.cardId)}
                    >
                      <span aria-hidden="true">🔍</span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="cid-section">
            <h3>変装</h3>
            {disgs.length === 0 ? (
              <p className="cid-empty">使用可能なカードなし</p>
            ) : (
              <ul className="cid-list">
                {disgs.map((c, index) => {
                  const occurrenceId = c.uid ?? `${c.cardId}#${index}`;
                  return (
                  <li key={`disg-${occurrenceId}`}>
                    <button
                      type="button"
                      className="cid-cand cid-cand-disg"
                      data-cid-primary-action="true"
                      onClick={() => onPickDisguise(c.cardId)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        expandModal.open(c.cardId);
                      }}
                      data-testid={`cid-disg-${occurrenceId}`}
                    >
                      <CardArt cardId={c.cardId} alt={c.name} className="cid-cand-art" />
                      {c.name}
                    </button>
                    <button
                      type="button"
                      className="cid-cand-detail"
                      data-testid={`cid-disg-detail-${occurrenceId}`}
                      aria-label={`${c.name}（${index + 1}枚目）の詳細を表示`}
                      onClick={() => expandModal.open(c.cardId)}
                    >
                      <span aria-hidden="true">🔍</span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        </div>
        <div className="cid-actions">
          <button
            type="button"
            className="cid-pass"
            data-cid-primary-action="true"
            onClick={onPass}
            data-testid="cid-pass"
          >
            パス
          </button>
        </div>
        <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
      </div>
    </div>
  );
}
