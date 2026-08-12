// 2026-05-27 カットイン効果検証 demo の card picker modal
//
// rules: 09-cutin-disguise.md
// spec: hirameki demo と同型 (HiramekiDemoPickerModal の cutin 版)
//
// 役割:
//   GameSetupModal の「カットインデモ」 button から開く。icon-cutin ability を持つ
//   全カードを enumerate して grid 表示。click で `onPick(cardId)` を発火、
//   親 (App.tsx) が setGameState(createCutinDemoState(cardId)) + mode='playing'
//   + dispatch actionDeclareChar を行う。

import type { JSX } from 'react';
import type { CardDef } from '@/engine/types';
import { ALL_CARDS } from '@/cards';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { cardIdToDisplayName, cardIdToPrintedNumber } from '@/ui/services/uidNames.js';
// hirameki picker と同じ class 名で見た目を流用 (色は青系統に override 可能だが
// まずは demo パターンの統一感を優先)
import './HiramekiDemoPickerModal.css';

export type CutinDemoPickerModalProps = {
  onPick: (cardId: string) => void;
  onClose: () => void;
};

/** ALL_CARDS から icon-cutin ability を持つカードを抽出 (module-level cache) */
function getIconCutinCards(): CardDef[] {
  return ALL_CARDS.filter((d) =>
    // 2026-05-27 Option C: 'icon-cutin' 廃止 → triggered + hook='effect:declared' + optional:true + scope='on-hand'
    d.abilities.some((a) => {
      const ab = a as { type?: string; scope?: string; trigger?: { hook?: string; optional?: boolean } };
      return ab.type === 'triggered' && ab.scope === 'on-hand'
        && ab.trigger?.hook === 'effect:declared' && ab.trigger?.optional === true;
    }),
  );
}

const ICON_CUTIN_CARDS = getIconCutinCards();

export function CutinDemoPickerModal(props: CutinDemoPickerModalProps): JSX.Element {
  const { onPick, onClose } = props;
  const expandModal = useCardExpandModal();
  const dialogRef = useModalFocusTrap({ active: true, onEscape: onClose });

  return (
    <div
      ref={dialogRef}
      className="hirameki-demo-picker-backdrop"
      role="dialog"
      data-match-modal-registered="true"
      aria-modal="true"
      aria-labelledby="cutin-demo-picker-title"
      data-testid="cutin-demo-picker"
      onClick={onClose}
    >
      <div
        className="hirameki-demo-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hirameki-demo-picker-header">
          <div>
            <h2 id="cutin-demo-picker-title">カットインデモ — カードを選んでください</h2>
            <p className="hirameki-demo-picker-hint">
              選んだカードは自分の手札に置かれ、相手の現場 #1
              が自分の現場 #1 (スリープ) に アクション[キャラ] を行います。
              ガードは自動 pass、コンタクト中にカットイン picker が開きます。
            </p>
          </div>
          <button
            type="button"
            className="hirameki-demo-picker-close"
            aria-label="閉じる"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="hirameki-demo-picker-grid">
          {ICON_CUTIN_CARDS.length === 0 ? (
            <div className="hirameki-demo-picker-empty">
              カットイン持ちカードが登録されていません。
            </div>
          ) : (
            ICON_CUTIN_CARDS.map((d) => {
              const cutin = d.abilities.find((a) => {
                const ab = a as { type?: string; scope?: string; trigger?: { hook?: string; optional?: boolean } };
                return ab.type === 'triggered' && ab.scope === 'on-hand'
                  && ab.trigger?.hook === 'effect:declared' && ab.trigger?.optional === true;
              }) as { description?: string } | undefined;
              return (
                <div className="hirameki-demo-picker-card-row" key={d.id}>
                  <button
                    type="button"
                    className="hirameki-demo-picker-card"
                    data-testid={`cutin-demo-pick-${d.id}`}
                    onClick={() => onPick(d.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      expandModal.open(d.id);
                    }}
                  >
                    <CardArt cardId={d.id} alt={cardIdToDisplayName(d.id)} className="hirameki-demo-picker-card-art" />
                    <div className="hirameki-demo-picker-card-name">
                      {cardIdToDisplayName(d.id)}
                    </div>
                    <div className="hirameki-demo-picker-card-id">
                      No.{cardIdToPrintedNumber(d.id)}
                    </div>
                    {cutin?.description && (
                      <div className="hirameki-demo-picker-card-desc">
                        {cutin.description}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    className="hirameki-demo-picker-card-detail"
                    data-testid={`cutin-demo-detail-${d.id}`}
                    aria-label={`${cardIdToDisplayName(d.id)}の詳細を表示`}
                    onClick={() => expandModal.open(d.id)}
                  >
                    <span aria-hidden="true">🔍</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
        <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
      </div>
    </div>
  );
}
