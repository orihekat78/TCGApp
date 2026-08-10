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
import { actionLabelForAction } from '@/ui/services/actionLabel.js';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog';
import type { NormalizedLogNode } from '@/engine/log/causal';
import './RecentActionToast.css';

const TOAST_DURATION_MS = 1500; // BUG-062: 連続 CPU move でも視認可能な短め

export function RecentActionToast({ suppressed = false }: { suppressed?: boolean } = {}): JSX.Element | null {
  const gameState = useGameStateStore((s) => s.gameState);
  const [visible, setVisible] = useState<NormalizedLogNode | null>(null);
  const cursorRef = useRef<{ sessionId: string; order: number } | null>(null);

  useEffect(() => {
    if (suppressed || !gameState) {
      cursorRef.current = null;
      setVisible(null);
      return;
    }
    const graph = normalizedGameLogForUi(gameState);
    const latest = graph.nodes.at(-1);
    if (!latest) {
      cursorRef.current = { sessionId: graph.sessionId, order: 0 };
      setVisible(null);
      return;
    }
    const cursor = cursorRef.current;
    if (cursor?.sessionId !== graph.sessionId || latest.order > cursor.order) {
      cursorRef.current = { sessionId: graph.sessionId, order: latest.order };
      setVisible(latest);
      return;
    }
    if (latest.order < cursor.order) {
      cursorRef.current = { sessionId: graph.sessionId, order: latest.order };
      setVisible(null);
    }
  }, [gameState, suppressed]);

  const visibleId = visible?.id ?? null;
  useEffect(() => {
    if (visibleId === null) return undefined;
    const t = setTimeout(() => setVisible(null), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [visibleId]);

  if (!visible) return null;
  const isOpp = visible.actor === 'opp';
  const who = isOpp ? '相手' : '自分';
  const target = visible.targets[0]?.label;
  return (
    <div
      className={`recent-action-toast ${isOpp ? 'is-opp' : 'is-self'}`}
      role="status"
      data-testid="recent-action-toast"
      data-player={visible.actor}
      style={{ pointerEvents: 'none' }}
    >
      {isOpp && <span className="toast-cpu-badge" aria-label="CPU">🤖</span>}
      <span className="toast-who">{who}</span>
      <span className="toast-action">{actionLabelForAction(visible.label)}</span>
      {target && <span className="toast-target">[{target}]</span>}
    </div>
  );
}
