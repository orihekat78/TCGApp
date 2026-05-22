// user_request 20260521_01 #12: 観戦モード speed slider HUD
// user_request 20260522_01 #15 (BUG-063): 人間 vs CPU でも展開 — CPU 行動の
// pause/step を可能にしてユーザー任意進行
//
// 役割:
//   - gameState !== null なら右上に小さな HUD を表示 (any active game)
//   - preset で AI/CPU ターン進行速度を選択 (aiSpeedMs を store に書き込む)
//   - useOppTurnDriver / useSpectatorTurnDriver が aiSpeedMs / isAiPaused /
//     aiStepCounter を subscribe して反映
//   - spectator: 「AI 速度」「制御」、human vs CPU: 「CPU 速度」「CPU 制御」
//
// z-index: 9100 (OppTurnOverlay 9000 より上、Modal 9700 より下)

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './SpectatorHUD.css';

type Preset = { label: string; ms: number };

// user_request 20260522_01 #14 BUG-058: 「まだ早い」フィードバックを受け、
// 最遅をさらに遅い 5000ms / 10000ms preset を追加
const PRESETS: readonly Preset[] = [
  { label: '高速', ms: 200 },
  { label: '標準', ms: 400 },
  { label: '普通', ms: 800 },
  { label: 'ゆっくり', ms: 1500 },
  { label: '最遅', ms: 3000 },
  { label: '5秒/手', ms: 5000 },
  { label: '10秒/手', ms: 10000 },
];

export function SpectatorHUD(): JSX.Element | null {
  // OppTurnOverlay と同じく getState() で SSR 互換性を維持。
  // 親 (App.tsx) が spectatorMode / aiSpeedMs / isAiPaused / aiStepCounter を
  // subscribe するため再描画は親経由で伝搬する。
  const store = useGameStateStore.getState();
  const { spectatorMode, aiSpeedMs, setAiSpeedMs, isAiPaused, setAiPaused, incrementAiStep, gameState } = store;
  // BUG-063: 観戦モードに加えて、人間 vs CPU (gameState !== null && !spectatorMode)
  // でも HUD を表示し CPU 行動の pause/step を可能にする
  if (gameState === null) return null;
  const speedLabel = spectatorMode ? 'AI 速度' : 'CPU 速度';
  const controlLabel = spectatorMode ? '制御' : 'CPU 制御';
  const ariaLabel = spectatorMode ? '観戦モード制御' : 'CPU 行動制御';

  return (
    <div className="spectator-hud" role="toolbar" aria-label={ariaLabel} data-testid="spectator-hud">
      <div className="spectator-hud-section">
        <span className="spectator-hud-label">{speedLabel}</span>
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
        <span className="spectator-hud-label">{controlLabel}</span>
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
