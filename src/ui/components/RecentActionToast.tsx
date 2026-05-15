// Phase 8.10b: 最近のアクション通知トースト
//
// 役割:
//   - state.log の末尾エントリを ~2.2 秒間トースト表示
//   - 次のエントリが来たら即時切替 (新 setTimeout)
//   - 自動 fade-out (cleanup 関数で StrictMode 二重起動耐性)

import { useEffect, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { actionLabel } from '@/ui/services/actionLabel.js';
import type { LogEntry } from '@/engine/types/game-state';
import './RecentActionToast.css';

const TOAST_DURATION_MS = 2200;

export function RecentActionToast(): JSX.Element | null {
  const gameState = useGameStateStore((s) => s.gameState);
  const [visible, setVisible] = useState<LogEntry | null>(null);

  const logLen = gameState?.log.length ?? 0;
  useEffect(() => {
    if (!gameState || logLen === 0) return undefined;
    const last = gameState.log[logLen - 1];
    setVisible(last);
    const t = setTimeout(
      () => setVisible((cur) => (cur === last ? null : cur)),
      TOAST_DURATION_MS,
    );
    return () => clearTimeout(t);
  }, [logLen, gameState]);

  if (!visible) return null;
  const who = visible.player === 'self' ? '自分' : '相手';
  return (
    <div className="recent-action-toast" role="status" data-testid="recent-action-toast">
      <span className="toast-who">{who}</span>
      <span className="toast-action">{actionLabel(visible)}</span>
      {visible.target && <span className="toast-target">[{visible.target}]</span>}
    </div>
  );
}
