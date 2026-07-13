import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

/** repeatOptional の一回分。選ぶまで outer continuation を再開しない。 */
export function EffectRepeatOptionalModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  if (!pending || pending.player !== 'self') return null;

  const card = pending.source.cardId ? readDef.card(pending.source.cardId) : undefined;
  const sourceName = card?.names?.[0] ?? pending.source.cardId ?? '能力';
  const desc = card?.abilities?.find((ability) => ability.id === pending.source.abilityId)?.description ?? '';

  return (
    <div className="cp-overlay" role="dialog" aria-labelledby="repeat-opt-title" aria-modal="true" data-testid="repeat-optional-picker-modal">
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="repeat-opt-title">続けますか？</h2>
          <p className="cp-sub">{desc ? `${sourceName}: ${desc}` : `${sourceName}: 効果を続けますか？`}</p>
          <p className="cp-sub">残り {pending.remaining} 回</p>
        </div>
        <div className="cp-body">
          <ul className="cp-list">
            <li><button type="button" className="cp-cand" data-testid="repeat-opt-run-yes" onClick={() => dispatchEngineAction({ type: 'repeatOptionalResolve', run: true })}>する</button></li>
            <li><button type="button" className="cp-cand" data-testid="repeat-opt-run-no" onClick={() => dispatchEngineAction({ type: 'repeatOptionalResolve', run: false })}>しない</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
