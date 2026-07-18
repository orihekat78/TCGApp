import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import './ChoicePickerModal.css';

/** Optional destination selection for a face-up set-card removal replacement. */
export function SetCardReplacementModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingSetCardReplacement);
  const expandModal = useCardExpandModal();
  if (!pending || pending.player !== 'self') return null;
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="set-card-replacement-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Move set card</h2><p className="cp-sub">Choose a character, or remove the card.</p></div>
      <div className="cp-body"><ul className="cp-list">{pending.candidates.map((candidate) => <li key={candidate.uid}><SelectableCardTile cardId={candidate.cardId} instanceId={candidate.uid} selectTestId={`set-card-replacement-${candidate.uid}`} onSelect={() => dispatchEngineAction({ type: 'setCardReplacementResolve', targetUid: candidate.uid })} onExpand={expandModal.open} /></li>)}</ul></div>
      <div className="cp-actions"><button type="button" className="cp-btn cp-btn-cancel" data-testid="set-card-replacement-decline" onClick={() => dispatchEngineAction({ type: 'setCardReplacementResolve', targetUid: null })}>Remove card</button></div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
  </div>;
}
