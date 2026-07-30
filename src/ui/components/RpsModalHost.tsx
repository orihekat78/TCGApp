import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import './ChoicePickerModal.css';

const hands = [
  ['rock', '\u30b0\u30fc'],
  ['paper', '\u30d1\u30fc'],
  ['scissors', '\u30c1\u30e7\u30ad'],
] as const;

/** Dedicated player-vs-AI rock-paper-scissors decision. */
export function RpsModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingRps);
  if (!pending || pending.player !== 'self') return null;
  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" aria-labelledby="rps-title" data-testid="rps-modal">
      <div className="cp-modal">
        <div className="cp-header"><h2 id="rps-title">\u3058\u3083\u3093\u3051\u3093</h2></div>
        <div className="cp-body"><p className="cp-sub">Choose a hand.</p></div>
        <div className="cp-actions"><ul className="cp-list">
          {hands.map(([hand, label]) => (
            <li key={hand}><button type="button" className="cp-cand" data-testid={`rps-${hand}`} onClick={() => dispatchEngineAction(bindPendingDecision(pending, { type: 'rpsResolve', hand }))}>{label}</button></li>
          ))}
        </ul></div>
      </div>
    </div>
  );
}
