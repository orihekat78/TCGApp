// Phase 7 Task 7.13: LogPanel
// 下端折りたたみログパネル。閉時は .log-btn のみ表示、開時はエントリ一覧。
// 開閉操作は Phase 8 (本コンポーネントは open prop を受け取って静的レンダ)。
//
// 視覚: design-mockups/01-board-mockup.html 1236-1241 (button のみ),
//       CSS 145-163 行 (.log-btn)
// 注: mock は下端パネル未実装 → ui-overall.md の「閉時 32px / 展開時 200px」
//     仕様を実装。閉時の見た目のみ mock の .log-btn を流用。

import type { JSX } from 'react';
import type { LogEntry } from '@/engine/types/game-state.js';
import './LogPanel.css';

export type LogPanelProps = {
  entries: LogEntry[];
  open: boolean;
  /** 表示する最新エントリ件数 (デフォルト 30) */
  maxEntries?: number;
};

const ACTION_LABEL: Record<string, string> = {
  reasoning: '推理',
  action: 'アクション',
  guard: 'ガード',
  contact: 'コンタクト',
  assist: 'アシスト',
  solveCase: '事件解決',
  handUse: '手札の使用',
  nextHint: 'ネクストヒント',
  refresh: 'リフレッシュ',
  endTurn: 'ターン終了',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function LogPanel({ entries, open, maxEntries = 30 }: LogPanelProps): JSX.Element {
  // 最新が末尾なら逆順、最新が先頭なら sorted のまま — engine の log は
  // append 順 (古→新) なので、逆順にして上が新しい表示にする。
  const sorted = entries.slice(-maxEntries).reverse();

  return (
    <div className={`log-panel${open ? ' open' : ''}`} aria-expanded={open}>
      <button
        type="button"
        className="log-btn"
        aria-label={open ? 'ログを閉じる' : 'ログを開く'}
        disabled
      >
        <span className="log-btn-icon" aria-hidden="true">▤</span>
        <span className="log-btn-label">LOG</span>
        <span className="log-btn-count">{entries.length}</span>
      </button>

      {open && (
        <div className="log-list" role="log" aria-live="polite">
          {sorted.length === 0 ? (
            <div className="log-empty">ログなし</div>
          ) : (
            sorted.map((e, i) => (
              <div
                key={`${e.ts}-${i}`}
                className={`log-entry side-${e.player}`}
              >
                <span className="log-time">{formatTime(e.ts)}</span>
                <span className="log-turn">T{e.turn}</span>
                <span className="log-player">{e.player === 'self' ? '自' : '相'}</span>
                <span className="log-action">{ACTION_LABEL[e.action] ?? e.action}</span>
                {e.target !== undefined && <span className="log-target">→ {e.target}</span>}
                {e.result !== undefined && <span className="log-result">: {e.result}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
