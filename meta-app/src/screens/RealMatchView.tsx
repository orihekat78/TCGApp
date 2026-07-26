// spec: .claude/specs/meta-ui/10-integration-with-src.md
// Phase 11-D: src/App.tsx の Playmat + modals + driver hooks ブロックを 5174 内に再構成
// すべて src/ から import — src/ には触らない
//
// 構造は src/App.tsx (133 行) と等価:
//   - 4 driver hooks (replay / effectPick / hiramekiDemo / cutinDemo)
//   - _setHumanPlayerSide(spectatorMode ? null : 'self') 効果
//   - Playmat + 14+ modals/overlays
//   - 終局検知 → onMatchEnd (5174 側で nav('result'))

import { useEffect } from 'react';
import { Playmat } from '@/ui/components/Playmat';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { OppTurnOverlay } from '@/ui/components/OppTurnOverlay';
import { SpectatorHUD } from '@/ui/components/SpectatorHUD';
import { ReplayPanel } from '@/ui/components/ReplayPanel';
import { useReplayDriver } from '@/ui/hooks/useReplayDriver';
import { RecentActionToast } from '@/ui/components/RecentActionToast';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { EffectDecisionModalHosts } from '@/ui/components/EffectDecisionModalHosts';
import { HiramekiDemoPickerModal } from '@/ui/components/HiramekiDemoPickerModal';
import { HiramekiDemoBanner } from '@/ui/components/HiramekiDemoBanner';
import { useHiramekiDemoDriver } from '@/ui/hooks/useHiramekiDemoDriver';
import { createHiramekiDemoState, HIRAMEKI_DEMO_OPP_ATTACKER_UID } from '@/ui/fixtures/hiramekiDemoState';
import { CutinDemoPickerModal } from '@/ui/components/CutinDemoPickerModal';
import { CutinDemoBanner } from '@/ui/components/CutinDemoBanner';
import { useCutinDemoDriver } from '@/ui/hooks/useCutinDemoDriver';
import { createCutinDemoState, CUTIN_DEMO_OPP_ATTACKER_UID, CUTIN_DEMO_SELF_DEFENDER_UID } from '@/ui/fixtures/cutinDemoState';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { ContactFlash } from '@/ui/components/ContactFlash';
import { RefreshOverlay } from '@/ui/components/RefreshOverlay';
import { VictoryOverlay } from '@/ui/components/VictoryOverlay';
import { TutorialOverlay } from '@/ui/components/TutorialOverlay';
import { resolveCard, resolveCase, resolveHandCard } from '../util/tutorialResolvers';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import '@/ui/styles/tokens.css';

// JSON は src/ がリポジトリルート相対参照しているのと同じパスにする
// resolver は ../util/tutorialResolvers から共有 import (Phase 17-C'、挙動は従来と同一)

interface Props {
  onMatchEnd: () => void;
}

export function RealMatchView({ onMatchEnd }: Props) {
  const gameState = useGameStateStore((s) => s.gameState);
  // 再描画 trigger: spectatorMode / aiSpeedMs / isAiPaused / aiStepCounter
  // src/App.tsx と同じ subscribe パターン
  useGameStateStore((s) => s.spectatorMode);
  useGameStateStore((s) => s.aiSpeedMs);
  useGameStateStore((s) => s.isAiPaused);
  useGameStateStore((s) => s.aiStepCounter);

  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  useEffect(() => {
    _setHumanPlayerSide(spectatorMode ? null : 'self');
  }, [spectatorMode]);

  // 4 driver hooks (src/App.tsx と同じ)
  const replayDriver = useReplayDriver();
  useEffectPickFlowDriver();
  useHiramekiDemoDriver();
  useCutinDemoDriver();

  // demo mode subscribe (GameSetupModal の hide 判定が getState() 依存)
  const hiramekiDemoMode = useGameStateStore((s) => s.hiramekiDemoMode);
  const cutinDemoMode = useGameStateStore((s) => s.cutinDemoMode);

  // Phase 11: 終局自動遷移 (engine.read.game.result が null 以外で確定)
  useEffect(() => {
    if (!gameState) return;
    const result = engine.read.game.result(gameState);
    if (result !== null) {
      // VictoryOverlay 描画後に遷移 (即時だと演出が見えない)
      const t = setTimeout(onMatchEnd, 1800);
      return () => clearTimeout(t);
    }
    return;
  }, [gameState, onMatchEnd]);

  // Meta アプリでは SetupScreen が対戦初期化を所有する。
  // マリガン待ち中に旧盤面や standalone 用 GameSetupModal を露出しない。
  if (gameState === null) {
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
      />
      {hiramekiDemoMode === 'picking' && (
        <HiramekiDemoPickerModal
          onPick={(cardId) => {
            useGameStateStore.getState().setHiramekiDemoSelectedCardId(cardId);
            useGameStateStore.getState().setGameState(createHiramekiDemoState(cardId));
            useGameStateStore.getState().setHiramekiDemoMode('playing');
            dispatchEngineAction({
              type: 'actionAgainstCase',
              byUid: HIRAMEKI_DEMO_OPP_ATTACKER_UID,
              targetPlayer: 'self',
            });
          }}
          onClose={() => useGameStateStore.getState().setHiramekiDemoMode('idle')}
        />
      )}
      <HiramekiDemoBanner />
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
      <CutinDemoBanner />
      <ReplayPanel driver={replayDriver} />
      <MulliganModal />
      <OppTurnOverlay />
      {/* BUG-088: replay 再生中は CPU 制御 HUD を出さない (ReplayPanel と top で重なり close を遮るため) */}
      {replayDriver.state.log === null && <SpectatorHUD />}
      <EffectPickerModal />
      <EffectDecisionModalHosts />
      <DeckRevealOverlay />
      <RecentActionToast />
      <ContactFlash />
      <RefreshOverlay />
      <VictoryOverlay />
      <TutorialOverlay />
    </>
  );
}
