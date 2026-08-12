// spec: .claude/specs/meta-ui/10-integration-with-src.md
// Phase 11-D: src/App.tsx の Playmat + modals + driver hooks ブロックを 5174 内に再構成
// すべて src/ から import — src/ には触らない
//
// 構造は src/App.tsx (133 行) と等価:
//   - 4 driver hooks (replay / effectPick / hiramekiDemo / cutinDemo)
//   - _setHumanPlayerSide(spectatorMode ? null : 'self') 効果
//   - Playmat + 14+ modals/overlays
//   - 終局検知 → onMatchEnd (5174 側で nav('result'))

import { useEffect, useRef } from 'react';
import { Playmat } from '@/ui/components/Playmat';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { ReplayPanel } from '@/ui/components/ReplayPanel';
import { replayViewerModeForLog, useReplayDriver } from '@/ui/hooks/useReplayDriver';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { EffectDecisionModalHosts } from '@/ui/components/EffectDecisionModalHosts';
import { HiramekiDemoPickerModal } from '@/ui/components/HiramekiDemoPickerModal';
import { HiramekiDemoBanner } from '@/ui/components/HiramekiDemoBanner';
import { useHiramekiDemoDriver } from '@/ui/hooks/useHiramekiDemoDriver';
import { startHiramekiDemoSession } from '@/ui/services/hiramekiDemoSession';
import { CutinDemoPickerModal } from '@/ui/components/CutinDemoPickerModal';
import { CutinDemoBanner } from '@/ui/components/CutinDemoBanner';
import { useCutinDemoDriver } from '@/ui/hooks/useCutinDemoDriver';
import { createCutinDemoState, CUTIN_DEMO_OPP_ATTACKER_UID, CUTIN_DEMO_SELF_DEFENDER_UID } from '@/ui/fixtures/cutinDemoState';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { PublicHandRevealWindow } from '@/ui/components/PublicHandRevealWindow';
import { PresentationCoordinatorHost } from '@/ui/presentation/PresentationCoordinatorHost';
import { VictoryOverlay } from '@/ui/components/VictoryOverlay';
import { TutorialOverlay } from '@/ui/components/TutorialOverlay';
import { resolveCard, resolveCase, resolveHandCard } from '../util/tutorialResolvers';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { useMetaStore } from '../state/metaStore';
import { isMatchSessionActive } from '@/ui/services/matchSession';
import { MatchMenu } from '../components/MatchMenu';
import '@/ui/styles/tokens.css';

// JSON は src/ がリポジトリルート相対参照しているのと同じパスにする
// resolver は ../util/tutorialResolvers から共有 import (Phase 17-C'、挙動は従来と同一)

interface Props {
  onMatchEnd: () => void;
  onReturnToSetup?: () => void;
}

export function RealMatchView({ onMatchEnd, onReturnToSetup = () => undefined }: Props) {
  const gameState = useGameStateStore((s) => s.gameState);
  const presentationSpeed = useMetaStore((s) => s.settings.presentationSpeed);
  const onMatchEndRef = useRef(onMatchEnd);
  const terminalTransitionIssuedRef = useRef(false);
  const observedLiveMatchRef = useRef(
    gameState !== null && engine.read.game.result(gameState) === null,
  );
  onMatchEndRef.current = onMatchEnd;
  // 再描画 trigger: spectatorMode / aiSpeedMs / isAiPaused / aiStepCounter
  // src/App.tsx と同じ subscribe パターン
  useGameStateStore((s) => s.spectatorMode);
  useGameStateStore((s) => s.aiSpeedMs);
  useGameStateStore((s) => s.isAiPaused);
  useGameStateStore((s) => s.aiStepCounter);

  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const initialHumanPlayerSide = useRef<'self' | null>(spectatorMode ? null : 'self');
  useEffect(() => {
    _setHumanPlayerSide(initialHumanPlayerSide.current);
    return () => _setHumanPlayerSide(null);
  }, []);

  // 4 driver hooks (src/App.tsx と同じ)
  const replayDriver = useReplayDriver();
  useEffectPickFlowDriver(replayDriver.state.log === null);
  useHiramekiDemoDriver();
  useCutinDemoDriver();

  // demo mode subscribe (GameSetupModal の hide 判定が getState() 依存)
  const hiramekiDemoMode = useGameStateStore((s) => s.hiramekiDemoMode);
  const cutinDemoMode = useGameStateStore((s) => s.cutinDemoMode);

  // Phase 11: 終局自動遷移 (engine.read.game.result が null 以外で確定)
  const gameResult = gameState ? engine.read.game.result(gameState) : null;

  useEffect(() => {
    if (gameResult === null) {
      if (gameState !== null) observedLiveMatchRef.current = true;
      terminalTransitionIssuedRef.current = false;
    }
  }, [gameResult, gameState]);

  const handleTerminalDrained = (): void => {
    if (gameResult === null || replayDriver.state.log !== null) return;
    // Browser Back can briefly remount MATCH with RESULT's terminal state.
    // Only a view that observed this match while it was live may own the
    // automatic transition to RESULT.
    if (!observedLiveMatchRef.current || terminalTransitionIssuedRef.current) return;
    terminalTransitionIssuedRef.current = true;
    onMatchEndRef.current();
  };

  const demoPickers = (
    <>
      {hiramekiDemoMode === 'picking' && (
        <HiramekiDemoPickerModal
          onPick={(cardId) => {
            startHiramekiDemoSession(cardId);
          }}
          onClose={() => useGameStateStore.getState().setHiramekiDemoMode('idle')}
        />
      )}
      {cutinDemoMode === 'picking' && (
        <CutinDemoPickerModal
          onPick={(cardId) => {
            useGameStateStore.getState().setCutinDemoSelectedCardId(cardId);
            useGameStateStore.getState().setGameState(createCutinDemoState(cardId));
            useGameStateStore.getState().setCutinDemoMode('playing');
            dispatchEngineAction({
              type: 'actionDeclareChar',
              byUid: CUTIN_DEMO_OPP_ATTACKER_UID,
              targetUid: CUTIN_DEMO_SELF_DEFENDER_UID,
            });
          }}
          onClose={() => useGameStateStore.getState().setCutinDemoMode('idle')}
        />
      )}
    </>
  );
  const hasDemoPicker = hiramekiDemoMode === 'picking' || cutinDemoMode === 'picking';

  // Meta アプリでは SetupScreen が対戦初期化を所有する。
  // マリガン待ち中に旧盤面や standalone 用 GameSetupModal を露出しない。
  if (gameState === null) {
    if (hasDemoPicker) return demoPickers;
    if (!isMatchSessionActive()) {
      return (
        <section className="match-recovery" role="alert" aria-labelledby="match-recovery-title">
          <p className="match-recovery__eyebrow">MATCH SESSION</p>
          <h1 id="match-recovery-title">対戦を開始できません</h1>
          <p>対戦情報がありません。ゲーム開始から対戦設定を行ってください。</p>
          <button
            type="button"
            data-testid="match-recovery-setup"
            onClick={onReturnToSetup}
          >
            対戦設定へ戻る
          </button>
        </section>
      );
    }
    return (
      <>
        <div role="status" style={{ padding: 24, color: '#9bb7c9' }}>
          対戦を準備しています…
        </div>
        <MulliganModal />
      </>
    );
  }

  return (
    <>
      <Playmat
        gameState={gameState}
        resolveCard={resolveCard}
        resolveCase={resolveCase}
        resolveHandCard={resolveHandCard}
        replayReadOnly={replayDriver.state.log !== null}
        replayViewer={replayViewerModeForLog(replayDriver.state.log)}
      />
      {demoPickers}
      <HiramekiDemoBanner />
      <CutinDemoBanner />
      <ReplayPanel driver={replayDriver} />
      <MulliganModal />
      {/* BUG-088: replay 再生中は CPU 制御 HUD を出さない (ReplayPanel と top で重なり close を遮るため) */}
      <EffectPickerModal />
      <EffectDecisionModalHosts />
      <MatchMenu replayActive={replayDriver.state.log !== null} />
      <DeckRevealOverlay />
      <PublicHandRevealWindow />
      <PresentationCoordinatorHost
        speed={presentationSpeed}
        suppressed={replayDriver.state.log !== null}
        onTerminalDrained={handleTerminalDrained}
      />
      <VictoryOverlay />
      <TutorialOverlay />
    </>
  );
}
