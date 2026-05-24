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
  const gameState = useGameStateStore((s) => s.gameState);
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

  /**
   * User 指摘 (BUG-077 後): 裏向き証拠の cardId/名前が EffectPickerModal で
   * 見えてしまう問題。証拠 candidate (uid='evidence:<side>:<idx>') について
   * gameState から faceUp を確認し、裏向きなら「(非公開)」表示にする。
   */
  const candDisplayName = (c: { uid: string; cardId: string }): string => {
    const evMatch = c.uid.match(/^evidence:(self|opp):(\d+)$/);
    if (evMatch && gameState) {
      const evPlayer = evMatch[1] as 'self' | 'opp';
      const evIdx = parseInt(evMatch[2]!, 10);
      const evCard = gameState.players[evPlayer]?.evidence?.[evIdx];
      if (evCard && !evCard.faceUp) return '(非公開)';
    }
    return readDef.card(c.cardId)?.names?.[0] ?? c.cardId;
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
            const name = candDisplayName(c);
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
