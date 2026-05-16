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
import './CutInDisguisePickerModal.css';

export type CutInDisguiseCandidate = {
  cardId: string;
  name: string;
  /** 'cutin' | 'disguise' */
  kind: 'cutin' | 'disguise';
};

export type CutInDisguisePickerModalProps = {
  open: boolean;
  /** どちらの行動順か (header 表示用) */
  actorLabel: '1番目' | '2番目' | '1番目 (再行動)';
  /** 候補カード (cutin と disguise が混在) */
  candidates: readonly CutInDisguiseCandidate[];
  onPickCutIn: (cardId: string) => void;
  onPickDisguise: (cardId: string) => void;
  onPass: () => void;
};

export function CutInDisguisePickerModal(props: CutInDisguisePickerModalProps): JSX.Element | null {
  const { open, actorLabel, candidates, onPickCutIn, onPickDisguise, onPass } = props;
  if (!open) return null;

  const cutins = candidates.filter((c) => c.kind === 'cutin');
  const disgs = candidates.filter((c) => c.kind === 'disguise');

  return (
    <div
      className="cid-overlay"
      role="dialog"
      aria-labelledby="cid-title"
      aria-modal="true"
      data-testid="cid-picker-modal"
    >
      <div className="cid-modal">
        <div className="cid-header">
          <h2 id="cid-title">コンタクト行動</h2>
          <p className="cid-sub">{`${actorLabel}: カットイン / 変装 を選択`}</p>
        </div>

        <div className="cid-body">
          <section className="cid-section">
            <h3>カットイン</h3>
            {cutins.length === 0 ? (
              <p className="cid-empty">使用可能なカードなし</p>
            ) : (
              <ul className="cid-list">
                {cutins.map((c) => (
                  <li key={`cutin-${c.cardId}`}>
                    <button
                      type="button"
                      className="cid-cand cid-cand-cutin"
                      onClick={() => onPickCutIn(c.cardId)}
                      data-testid={`cid-cutin-${c.cardId}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cid-section">
            <h3>変装</h3>
            {disgs.length === 0 ? (
              <p className="cid-empty">使用可能なカードなし</p>
            ) : (
              <ul className="cid-list">
                {disgs.map((c) => (
                  <li key={`disg-${c.cardId}`}>
                    <button
                      type="button"
                      className="cid-cand cid-cand-disg"
                      onClick={() => onPickDisguise(c.cardId)}
                      data-testid={`cid-disg-${c.cardId}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="cid-actions">
          <button
            type="button"
            className="cid-pass"
            onClick={onPass}
            data-testid="cid-pass"
          >
            パス
          </button>
        </div>
      </div>
    </div>
  );
}
