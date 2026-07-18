import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import './ChoicePickerModal.css';

/** Chooses a physical set-card without revealing its identity before selection. */
export function SetCardChoiceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingSetCardChoice);
  if (!pending || pending.player !== 'self') return null;
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="set-card-choice-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Set card</h2><p className="cp-sub">Choose one facedown set card.</p></div>
      <div className="cp-body"><ul className="cp-list">{pending.entries.map((entry) => <li key={entry.instanceId} className="cp-choice-row"><SelectableCardTile cardId="" instanceId={entry.instanceId} hidden hiddenLabel={`Set card ${entry.ordinal}`} selectTestId={`set-card-choice-${entry.ordinal}`} onSelect={() => dispatchEngineAction({ type: 'setCardChoiceResolve', instanceId: entry.instanceId })} /></li>)}</ul></div>
    </div>
  </div>;
}
