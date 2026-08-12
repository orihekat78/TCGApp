import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { def as readDef } from '@/engine/read/def.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap.js';
import './ChoicePickerModal.css';

/** repeatOptional の一回分。選ぶまで outer continuation を再開しない。 */
export function EffectRepeatOptionalModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const isOpen = pending !== null && isHumanDecisionOwner(pending.player, spectatorMode);
  const dialogRef = useModalFocusTrap({ active: isOpen });
  if (!isOpen || !pending) return null;

  const card = pending.source.cardId ? readDef.card(pending.source.cardId) : undefined;
  const sourceName = card?.names?.[0] ?? pending.source.cardId ?? '能力';
  const desc = card?.abilities?.find((ability) => ability.id === pending.source.abilityId)?.description ?? '';

  return (
    <div ref={dialogRef} className="cp-overlay" role="dialog" data-match-modal-registered="true" aria-labelledby="repeat-opt-title" aria-modal="true" data-testid="repeat-optional-picker-modal">
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="repeat-opt-title">続けますか？</h2>
          <p className="cp-sub">{desc ? `${sourceName}: ${desc}` : `${sourceName}: 効果を続けますか？`}</p>
          <p className="cp-sub">残り {pending.remaining} 回</p>
        </div>
        <div className="cp-body"><p className="cp-sub">Choose whether to repeat.</p></div>
        <div className="cp-actions">
          <ul className="cp-list">
            <li><button type="button" className="cp-cand" data-testid="repeat-opt-run-yes" onClick={() => dispatchEngineAction(bindPendingDecision(pending, { type: 'repeatOptionalResolve', run: true }))}>する</button></li>
            <li><button type="button" className="cp-cand" data-testid="repeat-opt-run-no" onClick={() => dispatchEngineAction(bindPendingDecision(pending, { type: 'repeatOptionalResolve', run: false }))}>しない</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
