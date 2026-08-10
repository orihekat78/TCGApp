import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { publicCardOccurrenceLabel } from '@/ui/services/uidNames.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import { LinkedPublicHandReveal } from './PublicHandRevealWindow.js';
import './ChoicePickerModal.css';

/** Dedicated responder prompt. This is intentionally separate from generic optional choices. */
export function ChooseInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingChooseIntercept);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const expandModal = useCardExpandModal();
  const isOpen = Boolean(pending && gameState && isHumanDecisionOwner(pending.player, spectatorMode));
  const dialogRef = useModalFocusTrap({ active: isOpen });
  if (!pending || !isOpen || !gameState) return null;

  const protector = readDef.card(pending.protector.cardId);
  const name = protector?.names[0] ?? pending.protector.cardId;
  const hand = gameState.players[pending.player].hand;
  const resolve = (discardIndex: number | null): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'chooseInterceptResolve', discardIndex }));
  };

  return (
    <div
      ref={dialogRef}
      className="cp-overlay"
      role="dialog"
      aria-labelledby="choose-intercept-title"
      aria-modal="true"
      tabIndex={-1}
      data-testid="choose-intercept-modal"
    >
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="choose-intercept-title">手札を1枚リムーブして、選んだ効果を続行しますか？</h2>
          <p className="cp-sub">
            {hand.length > 0
              ? `${name}の能力です。リムーブしない場合、選んだ効果は無効になります。`
              : `${name}の能力です。リムーブできないため、効果は無効になります。`}
          </p>
        </div>
        <div className="cp-body">
          <LinkedPublicHandReveal resolutionToken={pending.publicHandRevealToken} />
          <ul className="cp-list">
            {hand.map((cardId, index) => (
              <li key={`${cardId}-${index}`}>
                <SelectableCardTile
                  cardId={cardId}
                  instanceId={`hand:${pending.player}:${index}`}
                  occurrenceLabel={publicCardOccurrenceLabel(hand, cardId, index)}
                  selectLabelSuffix="をリムーブし、効果を続行"
                  selectTestId={`choose-intercept-discard-${index}`}
                  onSelect={() => resolve(index)}
                  onExpand={expandModal.open}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="cp-actions">
          <button type="button" className="cp-btn cp-btn-cancel" onClick={() => resolve(null)} data-testid="choose-intercept-decline">
            リムーブしない（効果を無効にする）
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
