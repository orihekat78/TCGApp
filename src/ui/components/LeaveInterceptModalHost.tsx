import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

export function LeaveInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingLeaveIntercept);
  const state = useGameStateStore((s) => s.gameState);
  if (!pending || pending.player !== 'self' || !state) return null;
  const interceptor = state.players.self.scene.find((c) => c.uid === pending.interceptorUid);
  const target = state.players.self.scene.find((c) => c.uid === pending.targetUid);
  const interceptorName = interceptor ? (readDef.card(interceptor.cardId)?.names?.[0] ?? interceptor.cardId) : 'character';
  const targetName = target ? (readDef.card(target.cardId)?.names?.[0] ?? target.cardId) : 'character';
  const resolve = (accept: boolean): void => { dispatchEngineAction({ type: 'leaveInterceptResolve', accept }); };
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="leave-intercept-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Leave intercept</h2><p className="cp-sub">Remove {interceptorName} to move {targetName} to hand?</p></div>
      <div className="cp-body"><ul className="cp-list"><li><button type="button" className="cp-cand" data-testid="leave-intercept-yes" onClick={() => resolve(true)}>Yes</button></li><li><button type="button" className="cp-cand" data-testid="leave-intercept-no" onClick={() => resolve(false)}>No</button></li></ul></div>
    </div>
  </div>;
}
