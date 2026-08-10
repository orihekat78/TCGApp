import { useEffect, useRef, useState } from 'react';
import type { ReplayViewerMode } from '@/ai/replay/state-frame';
import type { CausalOutcome, GameState } from '@/engine/types';
import { Playmat } from '@/ui/components/Playmat';
import { useReplayDriver } from '@/ui/hooks/useReplayDriver';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog';
import { actionLabelForAction } from '@/ui/services/actionLabel';
import { useGameStateStore } from '@/ui/state/store';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import type { Route } from '../router/routes';
import { replayArtifactIdFromHash } from '../router/useHashRoute';
import { loadHistoryReplayArtifact } from '../services/historyReplayRepository';
import {
  markReplayReturnFocus,
  markReplayReturnHeading,
} from '../services/replayReturnFocus';
import { resolveCard, resolveCase, resolveHandCard } from '../util/tutorialResolvers';
import './ReplayScreen.css';

interface Props { onNav: (route: Route) => void; }

type ReplayLoadState = 'loading' | 'ready' | 'error';

const SPEED_OPTIONS = [
  { value: 1_200, label: '0.5×' },
  { value: 600, label: '1.0×' },
  { value: 300, label: '2.0×' },
] as const;

function replayStepTotal(log: ReturnType<typeof useReplayDriver>['state']['log']): number {
  if (!log) return 0;
  return log.schemaVersion === 3 ? log.frames.length : log.moves.length;
}

function outcomeLabel(outcome: CausalOutcome): string | null {
  switch (outcome.type) {
    case 'none': return null;
    case 'count': return `${outcome.amount}${outcome.unit}`;
    case 'move': return `${outcome.from} → ${outcome.to}（${outcome.count}枚）`;
    case 'state': return outcome.state;
    case 'case-status': return '事件編から解決編へ';
    case 'face-change': return `${outcome.count}枚を${outcome.to === 'face-up' ? '表向き' : '裏向き'}に変更`;
    case 'summary': return `${outcome.count}件`;
  }
}

export function currentReplayEventSummary(
  gameState: GameState | null,
  viewerMode: ReplayViewerMode,
): string {
  if (!gameState) return '対戦開始時点';
  const node = normalizedGameLogForUi(gameState).nodes.at(-1);
  if (!node) return '対戦開始時点';
  const actor = viewerMode === 'spectator'
    ? (node.actor === 'self' ? 'CPU 1' : 'CPU 2')
    : (node.actor === 'self' ? 'プレイヤー' : 'CPU');
  const route = [node.source?.label, ...node.targets.map((target) => target.label)]
    .filter((value): value is string => Boolean(value))
    .join(' → ');
  const result = outcomeLabel(node.outcome);
  return [actor, actionLabelForAction(node.label), route, result]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
}

export function ReplayScreen({ onNav }: Props) {
  const [artifactId, setArtifactId] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : replayArtifactIdFromHash(window.location.hash)
  ));
  const [loadState, setLoadState] = useState<ReplayLoadState>('loading');
  const [manualAnnouncement, setManualAnnouncement] = useState('');
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const gameState = useGameStateStore((state) => state.gameState);
  const driver = useReplayDriver();
  const { loadLog, unloadLog } = driver;

  useEffect(() => {
    const updateArtifactId = () => setArtifactId(replayArtifactIdFromHash(window.location.hash));
    window.addEventListener('hashchange', updateArtifactId);
    window.addEventListener('popstate', updateArtifactId);
    return () => {
      window.removeEventListener('hashchange', updateArtifactId);
      window.removeEventListener('popstate', updateArtifactId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!artifactId) {
      setLoadState('error');
      return () => { cancelled = true; };
    }

    setLoadState('loading');
    setManualAnnouncement('');
    void loadHistoryReplayArtifact(artifactId).then((log) => {
      if (cancelled) return;
      loadLog(log);
      setLoadState('ready');
    }).catch(() => {
      if (!cancelled) setLoadState('error');
    });

    return () => {
      cancelled = true;
      unloadLog();
    };
  }, [artifactId, loadLog, unloadLog]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const frame = requestAnimationFrame(() => playButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [loadState]);

  const total = replayStepTotal(driver.state.log);
  const current = driver.state.currentMoveIndex;
  const atStart = current === 0;
  const atEnd = current >= total;
  const playbackStatus = driver.state.isPlaying
    ? '再生中'
    : atEnd && total > 0
      ? '再生完了'
      : '一時停止中';

  const exitReplay = (): void => {
    unloadLog();
    if (artifactId) markReplayReturnFocus(artifactId);
    else markReplayReturnHeading();
    onNav('history');
  };

  const togglePlayback = (): void => {
    if (driver.state.isPlaying) {
      driver.pause();
      return;
    }
    if (atEnd && total > 0) driver.seek(0);
    setManualAnnouncement('');
    driver.play();
  };

  const announceManualPosition = (position: number): void => {
    const log = driver.state.log;
    const state = useGameStateStore.getState().gameState;
    if (!log || !state) return;
    setManualAnnouncement(
      `リプレイ ${position} / ${total}。${currentReplayEventSummary(state, log.viewerMode)}`,
    );
  };

  const seekManually = (position: number): void => {
    driver.seek(position);
    announceManualPosition(position);
  };

  const stepManually = (): void => {
    const position = Math.min(current + 1, total);
    driver.step();
    announceManualPosition(position);
  };

  return (
    <div className="replay-screen">
      <PrimaryHeader current="history" onNav={(route) => {
        if (route === 'history') exitReplay();
        else onNav(route);
      }} />
      {loadState === 'ready' && driver.state.log && gameState ? (
        <main className="replay-runtime" aria-labelledby="replay-title">
          <h1 id="replay-title" className="replay-visually-hidden">対戦リプレイ</h1>
          <section className="replay-board" aria-label="記録された対戦盤面">
            <Playmat
              gameState={gameState}
              resolveCard={resolveCard}
              resolveCase={resolveCase}
              resolveHandCard={resolveHandCard}
              replayReadOnly
              replayViewer={driver.state.log.viewerMode}
            />
          </section>
          <aside className="replay-control-rail" aria-label="リプレイ操作">
            <div className="replay-control-heading">
              <span>リプレイ操作</span>
              <strong>{current} / {total}</strong>
            </div>
            <p className="replay-event-summary">
              {currentReplayEventSummary(gameState, driver.state.log.viewerMode)}
            </p>
            <label className="replay-progress-label">
              <span className="replay-visually-hidden">再生位置</span>
              <input
                type="range"
                min={0}
                max={Math.max(total, 1)}
                value={current}
                disabled={total === 0}
                onChange={(event) => seekManually(Number(event.currentTarget.value))}
              />
            </label>
            <p className="replay-playback-status" aria-live="polite">{playbackStatus}</p>
            <p
              className="replay-visually-hidden replay-manual-announcement"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {manualAnnouncement}
            </p>
            <button
              ref={playButtonRef}
              type="button"
              className="replay-primary-control"
              onClick={togglePlayback}
            >
              {driver.state.isPlaying ? '一時停止' : atEnd && total > 0 ? '最初から再生' : '再生'}
            </button>
            <button type="button" disabled={atStart} onClick={() => seekManually(current - 1)}>1件戻る</button>
            <button type="button" disabled={atEnd} onClick={stepManually}>1件進む</button>
            <label className="replay-speed-control">
              <span>速度</span>
              <select
                aria-label="再生速度"
                value={driver.state.speedMs}
                onChange={(event) => driver.setSpeed(Number(event.currentTarget.value))}
              >
                {SPEED_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button type="button" className="replay-exit-control" onClick={exitReplay}>リプレイを終了</button>
          </aside>
        </main>
      ) : (
        <main className="replay-unavailable" aria-labelledby="replay-title">
          <h1 id="replay-title">{loadState === 'loading' ? 'リプレイを読み込んでいます' : 'リプレイを開けません'}</h1>
          <p role={loadState === 'error' ? 'alert' : 'status'}>
            {loadState === 'loading'
              ? '対戦記録を確認しています。'
              : '記録が見つからないか、保存データを安全に検証できませんでした。'}
          </p>
          {loadState === 'error' && (
            <button type="button" onClick={exitReplay}>履歴へ戻る</button>
          )}
        </main>
      )}
    </div>
  );
}
