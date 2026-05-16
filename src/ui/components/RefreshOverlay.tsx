// Phase 8.10i: リフレッシュ全画面演出
//
// rules: 14-refresh.md / 26-qa-deck-refresh.md
//
// 役割:
//   - state.log の末尾が 'refresh' のとき、画面全体に 1.2 秒の演出
//   - 「リフレッシュ」テキスト + 回転アイコン
//   - 自動 fade-out。新しい refresh が来たら即時再生
//
// SSR 互換: useGameStateStore.getState() 直読

import { useEffect, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './RefreshOverlay.css';

const OVERLAY_DURATION_MS = 1200;

export function RefreshOverlay(): JSX.Element | null {
  const gameState = useGameStateStore.getState().gameState;
  const last = gameState?.log[gameState.log.length - 1];
  const isRefresh = last?.action === 'refresh';
  const player = isRefresh ? last!.player : null;

  const [cleared, setCleared] = useState(false);
  const logLen = gameState?.log.length ?? 0;

  useEffect(() => {
    if (!isRefresh) return undefined;
    setCleared(false);
    const t = setTimeout(() => setCleared(true), OVERLAY_DURATION_MS);
    return () => clearTimeout(t);
  }, [logLen, isRefresh]);

  if (!isRefresh || cleared) return null;
  const who = player === 'self' ? '自分' : '相手';
  return (
    <div className="refresh-overlay" data-testid="refresh-overlay" aria-live="polite">
      <div className="refresh-icon" aria-hidden="true">🔄</div>
      <div className="refresh-title">リフレッシュ</div>
      <div className="refresh-sub">{`${who}のデッキを再構築`}</div>
    </div>
  );
}
