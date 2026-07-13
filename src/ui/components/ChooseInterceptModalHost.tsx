import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

/** Dedicated responder prompt. This is intentionally separate from generic optional choices. */
export function ChooseInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingChooseIntercept);
  const gameState = useGameStateStore((s) => s.gameState);
  if (!pending || pending.player !== 'self' || !gameState) return null;

  const protector = readDef.card(pending.protector.cardId);
  const name = protector?.names[0] ?? pending.protector.cardId;
  const hand = gameState.players.self.hand;
  const resolve = (discardIndex: number | null): void => {
    dispatchEngineAction({ type: 'chooseInterceptResolve', discardIndex });
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
                <button type="button" className="cp-cand" onClick={() => resolve(index)} data-testid={`choose-intercept-discard-${index}`}>
                  Discard {readDef.card(cardId)?.names[0] ?? cardId}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="cp-cand" onClick={() => resolve(null)} data-testid="choose-intercept-decline">
                Do not cancel
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
