// user_request 20260521_01 #12: 観戦モード speed slider HUD
//
// 役割:
//   - spectatorMode === true のとき右上に小さな HUD を表示
//   - preset 5 段で AI ターン進行速度を選択 (aiSpeedMs を store に書き込む)
//   - useOppTurnDriver / useSpectatorTurnDriver が aiSpeedMs を subscribe して反映
//
// z-index: 9100 (OppTurnOverlay 9000 より上、Modal 9700 より下)

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './SpectatorHUD.css';

type Preset = { label: string; ms: number };

const PRESETS: readonly Preset[] = [
  { label: '高速', ms: 200 },
  { label: '標準', ms: 400 },
  { label: '普通', ms: 800 },
  { label: 'ゆっくり', ms: 1500 },
  { label: '最遅', ms: 3000 },
];

export function SpectatorHUD(): JSX.Element | null {
  // OppTurnOverlay と同じく getState() で SSR 互換性を維持。
  // 親 (App.tsx) が spectatorMode / aiSpeedMs / isAiPaused / aiStepCounter を
  // subscribe するため再描画は親経由で伝搬する。
  const store = useGameStateStore.getState();
  const { spectatorMode, aiSpeedMs, setAiSpeedMs, isAiPaused, setAiPaused, incrementAiStep } = store;
  if (!spectatorMode) return null;

  return (
    <div className="spectator-hud" role="toolbar" aria-label="観戦モード制御" data-testid="spectator-hud">
      <div className="spectator-hud-section">
        <span className="spectator-hud-label">AI 速度</span>
        <div className="spectator-hud-buttons">
          {PRESETS.map((p) => (
            <button
              key={p.ms}
              type="button"
              className={`spectator-hud-preset ${aiSpeedMs === p.ms ? 'is-active' : ''}`}
              onClick={() => setAiSpeedMs(p.ms)}
              data-testid={`spectator-speed-${p.ms}`}
              aria-pressed={aiSpeedMs === p.ms}
              title={`${p.label} (${p.ms}ms / ターン)`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="spectator-hud-current" data-testid="spectator-speed-current">
          {aiSpeedMs}ms
        </span>
      </div>
      <div className="spectator-hud-section">
        <span className="spectator-hud-label">制御</span>
        <button
          type="button"
          className={`spectator-hud-control ${isAiPaused ? 'is-paused' : ''}`}
          onClick={() => setAiPaused(!isAiPaused)}
          data-testid="spectator-pause-toggle"
          aria-pressed={isAiPaused}
          title={isAiPaused ? '再開 (resume)' : '一時停止 (pause)'}
        >
          {isAiPaused ? '▶ 再開' : '⏸ 一時停止'}
        </button>
        <button
          type="button"
          className="spectator-hud-control"
          onClick={() => incrementAiStep()}
          data-testid="spectator-step"
          disabled={!isAiPaused}
          title="1 ステップ進める (paused 時のみ)"
        >
          ⏭ 1 ステップ
        </button>
      </div>
    </div>
  );
}
