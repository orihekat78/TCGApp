import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { publicCardOccurrenceLabel } from '@/ui/services/uidNames.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import './ChoicePickerModal.css';

/** Dedicated responder prompt. This is intentionally separate from generic optional choices. */
export function ChooseInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingChooseIntercept);
  const gameState = useGameStateStore((s) => s.gameState);
  const expandModal = useCardExpandModal();
  if (!pending || pending.player !== 'self' || !gameState) return null;

  const protector = readDef.card(pending.protector.cardId);
  const name = protector?.names[0] ?? pending.protector.cardId;
  const hand = gameState.players.self.hand;
  const resolve = (discardIndex: number | null): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'chooseInterceptResolve', discardIndex }));
  };

  return (
    <div className="cp-overlay" role="dialog" aria-labelledby="choose-intercept-title" aria-modal="true" data-testid="choose-intercept-modal">
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="choose-intercept-title">Cancel selected effect?</h2>
          <p className="cp-sub">{name}: discard one card from your hand to cancel it.</p>
        </div>
        <div className="cp-body">
          <ul className="cp-list">
            {hand.map((cardId, index) => (
              <li key={`${cardId}-${index}`}>
                <SelectableCardTile
                  cardId={cardId}
                  instanceId={`hand:self:${index}`}
                  occurrenceLabel={publicCardOccurrenceLabel(hand, cardId, index)}
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
            Do not cancel
          </button>
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}
