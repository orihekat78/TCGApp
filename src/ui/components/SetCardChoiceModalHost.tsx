import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

/** Chooses a physical set-card without revealing its identity before selection. */
export function SetCardChoiceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingSetCardChoice);
  const state = useGameStateStore((s) => s.gameState);
  if (!pending || pending.player !== 'self' || !state) return null;
  const host = (['self', 'opp'] as const).flatMap((player) => state.players[player].scene).find((char) => char.uid === pending.hostUid);
  const hostName = host ? (readDef.card(host.cardId)?.names?.[0] ?? host.cardId) : 'character';
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="set-card-choice-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Set card</h2><p className="cp-sub">Choose a set card on {hostName}.</p></div>
      <div className="cp-body"><ul className="cp-list">{pending.entries.map((entry) => <li key={entry.instanceId}><button type="button" className="cp-cand" data-testid={`set-card-choice-${entry.ordinal}`} onClick={() => dispatchEngineAction({ type: 'setCardChoiceResolve', instanceId: entry.instanceId })}>Set card {entry.ordinal}</button></li>)}</ul></div>
    </div>
  </div>;
}
