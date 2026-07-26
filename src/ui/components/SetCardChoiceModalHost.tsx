import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { cancelSetCardCostChoice, confirmSetCardCostChoice, toggleSetCardCostChoice } from '@/ui/hooks/useSetCardCostPicker.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import './ChoicePickerModal.css';

/** Chooses a physical set-card without revealing its identity before selection. */
export function SetCardChoiceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingSetCardChoice);
  const expandModal = useCardExpandModal();
  if (!pending || pending.player !== 'self') return null;
  const isCost = pending.purpose === 'cost';
  const selected = new Set(pending.selectedInstanceIds ?? []);
  const canConfirm = selected.size >= (pending.nMin ?? 0) && selected.size <= (pending.nMax ?? 0);
  const movePrompt = pending.destination?.area === 'evidence'
    ? 'Choose one set card to move to evidence.'
    : pending.destination?.area === 'hand'
      ? 'Choose one set card to return to its owner hand.'
      : pending.destination?.area === 'scene'
        ? 'Choose one set card to move to the selected character.'
        : 'Choose one facedown set card.';
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="set-card-choice-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Set card</h2><p className="cp-sub">{isCost ? `${pending.nMin ?? 1}枚をコストとして選んでください。` : movePrompt}</p></div>
      <div className="cp-body"><ul className="cp-list">{pending.entries.map((entry) => {
        const hidden = entry.hidden ?? true;
        const hiddenLabel = entry.hostLabel ? `${entry.hostLabel}のセットカード ${entry.ordinal}` : `Set card ${entry.ordinal}`;
        return <li key={entry.instanceId} className={`cp-choice-row${selected.has(entry.instanceId) ? ' cp-choice-row--selected' : ''}`}><SelectableCardTile cardId={entry.cardId ?? ''} instanceId={entry.instanceId} hidden={hidden} hiddenLabel={hiddenLabel} selectTestId={`set-card-choice-${entry.ordinal}`} selected={selected.has(entry.instanceId)} onSelect={() => isCost ? toggleSetCardCostChoice(entry.instanceId) : dispatchEngineAction({ type: 'setCardChoiceResolve', instanceId: entry.instanceId })} onExpand={!hidden ? expandModal.open : undefined} /></li>;
      })}</ul></div>
      {isCost && <div className="cp-actions">
        <button type="button" className="cp-btn cp-btn-cancel" data-testid="set-card-cost-cancel" onClick={cancelSetCardCostChoice}>キャンセル</button>
        <button type="button" className="cp-btn" data-testid="set-card-cost-confirm" disabled={!canConfirm} onClick={confirmSetCardCostChoice}>確定</button>
      </div>}
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
  </div>;
}
