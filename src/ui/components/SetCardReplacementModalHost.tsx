import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

/** Optional destination selection for a face-up set-card removal replacement. */
export function SetCardReplacementModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingSetCardReplacement);
  if (!pending || pending.player !== 'self') return null;
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="set-card-replacement-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Move set card</h2><p className="cp-sub">Choose a character, or remove the card.</p></div>
      <div className="cp-body"><ul className="cp-list">{pending.candidates.map((candidate) => <li key={candidate.uid}><button type="button" className="cp-cand" data-testid={`set-card-replacement-${candidate.uid}`} onClick={() => dispatchEngineAction({ type: 'setCardReplacementResolve', targetUid: candidate.uid })}>{readDef.card(candidate.cardId)?.names?.[0] ?? candidate.cardId}</button></li>)}</ul>
        <button type="button" className="cp-cand" data-testid="set-card-replacement-decline" onClick={() => dispatchEngineAction({ type: 'setCardReplacementResolve', targetUid: null })}>Remove card</button>
      </div>
    </div>
  </div>;
}
