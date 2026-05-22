// user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択 modal
//
// 役割:
//   - useGameStateStore.pendingEffectPick を subscribe
//   - pending.player === 'self' で表示
//   - 候補から 1 つ選択 → effectPickResolve dispatch
//   - n.min === 0 (任意効果) なら「スキップ」button 表示

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './EffectPickerModal.css';

export function EffectPickerModal(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  if (!pending || pending.player !== 'self') return null;

  const sourceName = pending.source.cardId
    ? readDef.card(pending.source.cardId)?.names?.[0] ?? pending.source.cardId
    : '効果';
  const canSkip = pending.nMin === 0;

  const handlePick = (uid: string): void => {
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid });
  };
  const handleSkip = (): void => {
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
  };

  return (
    <div
      className="effect-picker-overlay"
      role="dialog"
      aria-labelledby="effect-picker-title"
      aria-modal="true"
      data-testid="effect-picker-modal"
    >
      <div className="effect-picker-modal">
        <div className="effect-picker-header">
          <h2 id="effect-picker-title">効果対象を選択</h2>
          <p className="effect-picker-sub">{`${sourceName}: 対象を選んでください`}</p>
        </div>
        <ul className="effect-picker-list">
          {pending.candidates.map((c) => {
            const name = readDef.card(c.cardId)?.names?.[0] ?? c.cardId;
            return (
              <li key={c.uid}>
                <button
                  type="button"
                  className="effect-picker-cand"
                  onClick={() => handlePick(c.uid)}
                  data-testid={`effect-pick-cand-${c.uid}`}
                >
                  <span className="cand-name">{name}</span>
                  <span className="cand-side">{c.player === 'self' ? '自' : '相'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {canSkip && (
          <div className="effect-picker-actions">
            <button
              type="button"
              className="effect-picker-skip"
              onClick={handleSkip}
              data-testid="effect-picker-skip"
            >
              対象を選ばない (任意効果)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
