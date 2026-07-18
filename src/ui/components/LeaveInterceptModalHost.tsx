import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { CardArt } from './CardArt.js';
import './ChoicePickerModal.css';

function LeaveInterceptCard({
  cardId,
  name,
  role,
  onExpand,
}: {
  cardId: string;
  name: string;
  role: 'interceptor' | 'target';
  onExpand: (cardId: string) => void;
}): JSX.Element {
  const expand = (): void => onExpand(cardId);
  return (
    <div className="leave-intercept-card">
      <button
        type="button"
        className="leave-intercept-card-select"
        data-testid={`leave-intercept-card-${role}`}
        aria-label={`${name}の詳細を表示`}
        onClick={expand}
        onContextMenu={(event) => {
          event.preventDefault();
          expand();
        }}
      >
        <CardArt cardId={cardId} alt="" />
        <span>{name}</span>
      </button>
      <button
        type="button"
        className="leave-intercept-card-detail"
        data-testid={`leave-intercept-card-detail-${role}`}
        aria-label={`${name}の詳細を表示`}
        onClick={expand}
      >
        詳細
      </button>
    </div>
  );
}

export function LeaveInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingLeaveIntercept);
  const state = useGameStateStore((s) => s.gameState);
  const expandModal = useCardExpandModal();
  if (!pending || pending.player !== 'self' || !state) return null;
  const interceptor = state.players.self.scene.find((c) => c.uid === pending.interceptorUid);
  const target = state.players.self.scene.find((c) => c.uid === pending.targetUid);
  const interceptorName = interceptor ? (readDef.card(interceptor.cardId)?.names?.[0] ?? interceptor.cardId) : 'character';
  const targetName = target ? (readDef.card(target.cardId)?.names?.[0] ?? target.cardId) : 'character';
  const resolve = (accept: boolean): void => { dispatchEngineAction({ type: 'leaveInterceptResolve', accept }); };
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="leave-intercept-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Leave intercept</h2><p className="cp-sub">Remove {interceptorName} to move {targetName} to hand?</p></div>
      <div className="cp-body">
        <div className="leave-intercept-cards">
          {interceptor && <LeaveInterceptCard cardId={interceptor.cardId} name={interceptorName} role="interceptor" onExpand={expandModal.open} />}
          {target && <LeaveInterceptCard cardId={target.cardId} name={targetName} role="target" onExpand={expandModal.open} />}
        </div>
        <ul className="cp-list"><li><button type="button" className="cp-cand" data-testid="leave-intercept-yes" onClick={() => resolve(true)}>Yes</button></li><li><button type="button" className="cp-cand" data-testid="leave-intercept-no" onClick={() => resolve(false)}>No</button></li></ul>
      </div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
  </div>;
}
