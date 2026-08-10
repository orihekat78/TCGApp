// Phase 9-G.2 (Cleanup 7-B): リプレイ playback UI panel
//
// 役割:
//   - useReplayDriver hook の state を表示し、play/pause/step/seek/speed を操作
//   - 配置: 画面上部固定 (z-index 9100)
//   - log === null なら非表示

import type { JSX } from 'react';
import { replayTotalSteps, type ReplayDriverApi } from '@/ui/hooks/useReplayDriver.js';
import './ReplayPanel.css';

const SPEED_PRESETS = [
  { label: '高速', ms: 200 },
  { label: '標準', ms: 600 },
  { label: 'ゆっくり', ms: 1500 },
  { label: '最遅', ms: 3000 },
] as const;

export function ReplayPanel({ driver }: { driver: ReplayDriverApi }): JSX.Element | null {
  const { state, play, pause, step, seek, setSpeed, unloadLog } = driver;
  if (!state.log) return null;

  const total = replayTotalSteps(state.log);
  const cur = state.currentMoveIndex;
  const currentMove = state.log.schemaVersion !== 3 && cur > 0 && cur <= total
    ? state.log.moves[cur - 1]
    : null;

  return (
    <div className="replay-panel" role="toolbar" aria-label="リプレイ制御" data-testid="replay-panel">
      <div className="replay-panel-row">
        <span className="replay-panel-label">リプレイ</span>
        <button
          type="button"
          className="replay-panel-btn"
          onClick={state.isPlaying ? pause : play}
          data-testid="replay-play-pause"
          aria-pressed={state.isPlaying}
        >
          {state.isPlaying ? '⏸ 一時停止' : '▶ 再生'}
        </button>
        <button
          type="button"
          className="replay-panel-btn"
          onClick={step}
          data-testid="replay-step"
          disabled={cur >= total}
        >
          ⏭ 1 手
        </button>
        <span className="replay-panel-progress" data-testid="replay-progress">
          {cur} / {total}
        </span>
        <input
          type="range"
          className="replay-panel-seek"
          min={0}
          max={total}
          value={cur}
          onChange={(e) => seek(Number(e.target.value))}
          data-testid="replay-seek"
          aria-label="seek"
        />
        <button
          type="button"
          className="replay-panel-btn replay-panel-close"
          onClick={unloadLog}
          data-testid="replay-close"
          aria-label="リプレイを閉じる"
        >
          ✕
        </button>
      </div>
      <div className="replay-panel-row">
        <span className="replay-panel-label">速度</span>
        {SPEED_PRESETS.map((p) => (
          <button
            key={p.ms}
            type="button"
            className={`replay-panel-preset ${state.speedMs === p.ms ? 'is-active' : ''}`}
            onClick={() => setSpeed(p.ms)}
            data-testid={`replay-speed-${p.ms}`}
            aria-pressed={state.speedMs === p.ms}
          >
            {p.label}
          </button>
        ))}
        <span className="replay-panel-current" data-testid="replay-speed-current">
          {state.speedMs}ms
        </span>
        {currentMove && (
          <span className="replay-panel-move-info" data-testid="replay-move-info">
            T{currentMove.turn} · {currentMove.player === 'self' ? '自' : '相'} · {currentMove.move.kind}
          </span>
        )}
      </div>
    </div>
  );
}
