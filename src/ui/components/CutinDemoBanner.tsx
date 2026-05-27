// 2026-05-27 カットイン効果検証 demo 完了 banner (HiramekiDemoBanner の cutin 版)

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
// CSS は hirameki banner と共有 (色だけ追加クラスで上書き)
import './HiramekiDemoBanner.css';

export function CutinDemoBanner(): JSX.Element | null {
  const mode = useGameStateStore((s) => s.cutinDemoMode);
  const cardId = useGameStateStore((s) => s.cutinDemoSelectedCardId);
  if (mode !== 'completed') return null;

  const handleReset = (): void => {
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setCutinDemoMode('picking');
    useGameStateStore.getState().setCutinDemoSelectedCardId(null);
  };
  const handleExit = (): void => {
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setCutinDemoMode('idle');
    useGameStateStore.getState().setCutinDemoSelectedCardId(null);
  };

  return (
    <div className="hirameki-demo-banner" role="status" data-testid="cutin-demo-banner">
      <div className="hirameki-demo-banner-text">
        <strong>カットインデモ完了</strong>
        {cardId && (
          <span className="hirameki-demo-banner-card">
            {' '}— {cardIdToDisplayName(cardId)} のカットイン解決まで進みました
          </span>
        )}
      </div>
      <div className="hirameki-demo-banner-actions">
        <button
          type="button"
          className="hirameki-demo-banner-reset"
          onClick={handleReset}
          data-testid="cutin-demo-banner-reset"
        >
          別カードで Reset
        </button>
        <button
          type="button"
          className="hirameki-demo-banner-exit"
          onClick={handleExit}
          data-testid="cutin-demo-banner-exit"
        >
          終了
        </button>
      </div>
    </div>
  );
}
