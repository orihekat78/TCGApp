// Phase 8.10i: リフレッシュ全画面演出
//
// rules: 14-refresh.md / 26-qa-deck-refresh.md
//
// 役割:
//   - 正規化済み因果イベント列の末尾がリフレッシュのとき、画面全体に 1.2 秒の演出
//   - 「リフレッシュ」テキスト + 回転アイコン
//   - 自動 fade-out。新しい refresh が来たら即時再生
//
// SSR 互換: useGameStateStore.getState() 直読

import { useEffect, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog.js';
import './RefreshOverlay.css';

const OVERLAY_DURATION_MS = 1200;

type RefreshOverlayProps = {
  suppressed?: boolean;
};

export function RefreshOverlay({ suppressed = false }: RefreshOverlayProps = {}): JSX.Element | null {
  const gameState = useGameStateStore.getState().gameState;
  const last = !suppressed && gameState
    ? normalizedGameLogForUi(gameState).nodes.at(-1)
    : undefined;
  const isRefresh = last?.tags.includes('refresh') === true;
  const player = isRefresh ? last.actor : null;

  const [cleared, setCleared] = useState(false);
  const eventId = last?.id ?? null;

  useEffect(() => {
    if (!isRefresh) return undefined;
    setCleared(false);
    const t = setTimeout(() => setCleared(true), OVERLAY_DURATION_MS);
    return () => clearTimeout(t);
  }, [eventId, isRefresh]);

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
