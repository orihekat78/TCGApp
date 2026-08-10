import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { CardArt } from './CardArt.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
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
  const detailLabel = `${role === 'interceptor' ? '置換するキャラ' : '手札に戻す対象'}・${name}の詳細を表示`;
  return (
    <div className="leave-intercept-card">
      <button
        type="button"
        className="leave-intercept-card-select"
        data-testid={`leave-intercept-card-${role}`}
        aria-label={detailLabel}
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
        aria-label={detailLabel}
        onClick={expand}
      >
        <span aria-hidden="true">🔍</span>
      </button>
    </div>
  );
}

export function LeaveInterceptModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingLeaveIntercept);
  const state = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const expandModal = useCardExpandModal();
  if (!pending || !isHumanDecisionOwner(pending.player, spectatorMode) || !state) return null;
  const interceptor = state.players[pending.player].scene.find((c) => c.uid === pending.interceptorUid);
  const target = state.players[pending.player].scene.find((c) => c.uid === pending.targetUid);
  const interceptorName = interceptor ? (readDef.card(interceptor.cardId)?.names?.[0] ?? interceptor.cardId) : 'character';
  const targetName = target ? (readDef.card(target.cardId)?.names?.[0] ?? target.cardId) : 'character';
  const resolve = (accept: boolean): void => {
    dispatchEngineAction(bindPendingDecision(pending, { type: 'leaveInterceptResolve', accept }));
  };
  return <div className="cp-overlay" role="dialog" aria-modal="true" data-testid="leave-intercept-modal">
    <div className="cp-modal"><div className="cp-header"><h2>Leave intercept</h2><p className="cp-sub">Remove {interceptorName} to move {targetName} to hand?</p></div>
      <div className="cp-body">
        <div className="leave-intercept-cards">
          {interceptor && <LeaveInterceptCard cardId={interceptor.cardId} name={interceptorName} role="interceptor" onExpand={expandModal.open} />}
          {target && <LeaveInterceptCard cardId={target.cardId} name={targetName} role="target" onExpand={expandModal.open} />}
        </div>
      </div>
      <div className="cp-actions"><button type="button" className="cp-btn" data-testid="leave-intercept-yes" onClick={() => resolve(true)}>Yes</button><button type="button" className="cp-btn cp-btn-cancel" data-testid="leave-intercept-no" onClick={() => resolve(false)}>No</button></div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
  </div>;
}
