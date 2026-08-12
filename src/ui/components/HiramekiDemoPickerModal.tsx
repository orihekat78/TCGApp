// 2026-05-26 ヒラメキ効果検証 demo の card picker modal
//
// rules: 10-action-event.md §ヒラメキ
// spec: plan ファイル「ヒラメキ効果検証デモプレイ環境」
//
// 役割:
//   GameSetupModal の「ヒラメキデモ」 button から開く。icon-flash ability を持つ
//   全カードを enumerate して grid 表示。click で `onPick(cardId)` を発火、
//   親 (App / RealMatchView) が共通 demo session を開始する。

import type { JSX } from 'react';
import type { CardDef } from '@/engine/types';
import { ALL_CARDS } from '@/cards';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { cardIdToDisplayName, cardIdToPrintedNumber } from '@/ui/services/uidNames.js';
import './HiramekiDemoPickerModal.css';

export type HiramekiDemoPickerModalProps = {
  /** カードが選択された時の handler */
  onPick: (cardId: string) => void;
  /** モーダルを閉じる (Esc / × ボタン) */
  onClose: () => void;
};

/** ALL_CARDS から icon-flash ability を持つカードを抽出 (キャッシュ目的の module-level 計算) */
function getIconFlashCards(): CardDef[] {
  return ALL_CARDS.filter((d) =>
    // 2026-05-27 Option C: 'icon-flash' 廃止 → triggered + hook='evidence:remove-by-action' + optional:true
    d.abilities.some((a) => {
      const ab = a as { type?: string; trigger?: { hook?: string; optional?: boolean } };
      return ab.type === 'triggered' && ab.trigger?.hook === 'evidence:remove-by-action' && ab.trigger?.optional === true;
    }),
  );
}

const ICON_FLASH_CARDS = getIconFlashCards();

export function HiramekiDemoPickerModal(props: HiramekiDemoPickerModalProps): JSX.Element {
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
      aria-labelledby="hirameki-demo-picker-title"
      data-testid="hirameki-demo-picker"
      onClick={onClose}
    >
      <div
        className="hirameki-demo-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hirameki-demo-picker-header">
          <div>
            <h2 id="hirameki-demo-picker-title">ヒラメキデモ — カードを選んでください</h2>
            <p className="hirameki-demo-picker-hint">
              選んだカードは自分の証拠最上部に裏向きで配置され、相手の現場 #1
              が事件カードアクションを行います。証拠リムーブ時にヒラメキが発動します。
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
          {ICON_FLASH_CARDS.length === 0 ? (
            <div className="hirameki-demo-picker-empty">
              ヒラメキ持ちカードが登録されていません。
            </div>
          ) : (
            ICON_FLASH_CARDS.map((d) => {
              const flash = d.abilities.find((a) => {
                const ab = a as { type?: string; trigger?: { hook?: string; optional?: boolean } };
                return ab.type === 'triggered' && ab.trigger?.hook === 'evidence:remove-by-action' && ab.trigger?.optional === true;
              }) as { description?: string } | undefined;
              return (
                <div className="hirameki-demo-picker-card-row" key={d.id}>
                  <button
                    type="button"
                    className="hirameki-demo-picker-card"
                    data-testid={`hirameki-demo-pick-${d.id}`}
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
                    {flash?.description && (
                      <div className="hirameki-demo-picker-card-desc">
                        {flash.description}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    className="hirameki-demo-picker-card-detail"
                    data-testid={`hirameki-demo-detail-${d.id}`}
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
