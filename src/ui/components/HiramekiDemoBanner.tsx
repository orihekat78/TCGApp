// 2026-05-26 ヒラメキ効果検証 demo 完了 banner
//
// rules: 10-action-event.md §ヒラメキ
// spec: plan ファイル「ヒラメキ効果検証デモプレイ環境」
//
// 役割:
//   hiramekiDemoMode === 'completed' の時に画面上部に banner 表示。
//   選んだカードと発動した効果の要約 + 「Reset」ボタン (picker に戻る) +
//   「終了」ボタン (idle に戻り GameSetupModal へ復帰)。

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
import './HiramekiDemoBanner.css';

export function HiramekiDemoBanner(): JSX.Element | null {
  const mode = useGameStateStore((s) => s.hiramekiDemoMode);
  const cardId = useGameStateStore((s) => s.hiramekiDemoSelectedCardId);
  if (mode !== 'completed') return null;

  const handleReset = (): void => {
    // picker に戻る (gameState クリア + mode='picking')
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setHiramekiDemoMode('picking');
    useGameStateStore.getState().setHiramekiDemoSelectedCardId(null);
  };
  const handleExit = (): void => {
    // 通常タイトル画面 (GameSetupModal) に戻る
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setHiramekiDemoMode('idle');
    useGameStateStore.getState().setHiramekiDemoSelectedCardId(null);
  };

  return (
    <div className="hirameki-demo-banner" role="status" data-testid="hirameki-demo-banner">
      <div className="hirameki-demo-banner-text">
        <strong>ヒラメキデモ完了</strong>
        {cardId && (
          <span className="hirameki-demo-banner-card">
            {' '}— {cardIdToDisplayName(cardId)} の能力解決まで進みました
          </span>
        )}
      </div>
      <div className="hirameki-demo-banner-actions">
        <button
          type="button"
          className="hirameki-demo-banner-reset"
          onClick={handleReset}
          data-testid="hirameki-demo-banner-reset"
        >
          別カードで Reset
        </button>
        <button
          type="button"
          className="hirameki-demo-banner-exit"
          onClick={handleExit}
          data-testid="hirameki-demo-banner-exit"
        >
          終了
        </button>
      </div>
    </div>
  );
}
