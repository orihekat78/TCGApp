// Phase 8.10b + BUG-062 (user_request 20260522_01 #15):
// 最近のアクション通知トースト — queue ベース表示
//
// 役割:
//   - state.log の末尾エントリを queue に enqueue
//   - 現在表示中の entry が 1500ms 完了するまで次は表示しない (FIFO)
//   - CPU side (player==='opp') は border/badge を強調表示
//   - 連続 CPU move でも 1 件ずつ確実に視認可能
//
// 設計:
//   - queue は state で保持 (immutable update)
//   - log 末尾 index を ref で追跡し、新規 push 時に queue へ append
//   - cardId 形式の target は cardName に解決 (LogPanel と同パターン)

import { useEffect, useRef, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { actionLabel } from '@/ui/services/actionLabel.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
import type { LogEntry } from '@/engine/types/game-state';
import './RecentActionToast.css';

const TOAST_DURATION_MS = 1500; // BUG-062: 連続 CPU move でも視認可能な短め

function formatTarget(target: string | undefined): string | undefined {
  if (!target) return undefined;
  if (/^D\d{2}\d{3}/.test(target)) {
    const name = cardIdToDisplayName(target);
    return name === target ? target : name;
  }
  return target;
}

export function RecentActionToast(): JSX.Element | null {
  const gameState = useGameStateStore((s) => s.gameState);
  const [visible, setVisible] = useState<LogEntry | null>(null);
  const queueRef = useRef<LogEntry[]>([]);
  const lastSeenLenRef = useRef<number>(0);

  // 新規 log entry を queue に enqueue
  const logLen = gameState?.log.length ?? 0;
  useEffect(() => {
    if (!gameState) return;
    if (logLen > lastSeenLenRef.current) {
      const newEntries = gameState.log.slice(lastSeenLenRef.current, logLen);
      queueRef.current = [...queueRef.current, ...newEntries];
      lastSeenLenRef.current = logLen;
      // 何も表示中でなければ即時 dequeue
      if (visible === null && queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        setVisible(next);
      }
    }
    // log が短くなった (新規ゲーム) 場合は reset
    if (logLen < lastSeenLenRef.current) {
      queueRef.current = [];
      lastSeenLenRef.current = logLen;
      setVisible(null);
    }
  }, [logLen, gameState, visible]);

  // visible が set されたら TOAST_DURATION_MS 後に dequeue
  useEffect(() => {
    if (visible === null) return undefined;
    const t = setTimeout(() => {
      const next = queueRef.current.shift() ?? null;
      setVisible(next);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  const isOpp = visible.player === 'opp';
  const who = isOpp ? '相手' : '自分';
  return (
    <div
      className={`recent-action-toast ${isOpp ? 'is-opp' : 'is-self'}`}
      role="status"
      data-testid="recent-action-toast"
      data-player={visible.player}
    >
      {isOpp && <span className="toast-cpu-badge" aria-label="CPU">🤖</span>}
      <span className="toast-who">{who}</span>
      <span className="toast-action">{actionLabel(visible)}</span>
      {visible.target && <span className="toast-target">[{formatTarget(visible.target)}]</span>}
    </div>
  );
}
