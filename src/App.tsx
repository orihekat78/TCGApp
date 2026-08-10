// Phase 7 demo + Phase 8.5 store bridge:
// sampleGameState を useGameStateStore に push し、以降は store を真実の源として
// Playmat に渡す。これによって useEngineDispatch 経由の更新が UI に反映される。

import { Playmat } from '@/ui/components/Playmat';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { ReplayPanel } from '@/ui/components/ReplayPanel';
import { replayViewerModeForLog, useReplayDriver } from '@/ui/hooks/useReplayDriver';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { useEffect } from 'react';
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
import { registerAll } from '@/cards/index';
import {
  createCardResolver,
  createCaseResolver,
  createHandCardResolver,
} from '@/ui/services/cardResolvers';
import { useGameStateStore } from '@/ui/state/store.js';
import '@/ui/styles/tokens.css';

import ctD08 from '../ct-d08-cards.json';
import ctD11 from '../ct-d11-cards.json';

const resolveCard = createCardResolver(ctD08 as never, ctD11 as never);
const resolveCase = createCaseResolver(ctD08 as never, ctD11 as never);
const resolveHandCard = createHandCardResolver(ctD08 as never, ctD11 as never);

// Task 8.4: 起動時の sampleGameState 自動 push を廃止。
// gameState === null のとき GameSetupModal が表示され、ユーザの「対戦開始」操作で
// setGameState が呼ばれる動線に変更。

// Task 8.4b: カード CardDef を起動時に 1 回だけ登録。
// performGameStart() 内の setup.init が validateDeck で参照するため必須。
registerAll();

export default function App() {
  // Store から購読: dispatch が走ったときに再描画される。
  const gameState = useGameStateStore((s) => s.gameState);
  // user_request 20260522_01 #6/#2: spectator mode に応じて humanPlayerSide
  // を engine 側 globalThis 側チャネルに反映。triggered listener が「human
  // 所有 effect は auto-pick せず」に判定する材料。
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  useEffect(() => {
    _setHumanPlayerSide(spectatorMode ? null : 'self');
  }, [spectatorMode]);
  // Phase 9-G.2: リプレイ playback driver
  const replayDriver = useReplayDriver();
  // BUG-054 (user_request 20260522_01 #2/#6): human effect pick driver
  useEffectPickFlowDriver(replayDriver.state.log === null);
  // 2026-05-26: ヒラメキ効果検証 demo の完了検知 driver。
  // hiramekiDemoMode='playing' 中、pendingHirameki が non-null → null になったら
  // mode='completed' へ。HiramekiDemoBanner が表示される。
  useHiramekiDemoDriver();
  // 2026-05-27: カットイン効果検証 demo の完了検知 driver。
  useCutinDemoDriver();
  // demoMode を subscribe して mode 変化時に App を再描画 (GameSetupModal
  // の hide 判定が getState() 依存のため、親の再描画が必須)。
  const hiramekiDemoMode = useGameStateStore((s) => s.hiramekiDemoMode);
  const cutinDemoMode = useGameStateStore((s) => s.cutinDemoMode);
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
      <GameSetupModal onLoadReplay={replayDriver.loadLog} />
      {hiramekiDemoMode === 'picking' && (
        <HiramekiDemoPickerModal
          onPick={(cardId) => {
            startHiramekiDemoSession(cardId);
          }}
          onClose={() => useGameStateStore.getState().setHiramekiDemoMode('idle')}
        />
      )}
      <HiramekiDemoBanner />
      {cutinDemoMode === 'picking' && (
        <CutinDemoPickerModal
          onPick={(cardId) => {
            // 1. 選択 cardId を記録 (banner 表示用)
            useGameStateStore.getState().setCutinDemoSelectedCardId(cardId);
            // 2. demo 初期 gameState を構築 (self.hand=[cardId]、self.scene defender、opp.scene attacker)
            useGameStateStore.getState().setGameState(createCutinDemoState(cardId));
            // 3. mode を 'playing' に遷移 (driver は playing 中の log で contact-cutin 検知)
            useGameStateStore.getState().setCutinDemoMode('playing');
            // 4. opp attacker → self defender へ action[char] dispatch
            //    useContactFlowDriver が引き取って guard-window → action-1 → cutin picker と進行
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
      {/* BUG-088: replay 再生中は CPU 制御 HUD を出さない (ReplayPanel と top で重なり close を遮るため) */}
      <EffectPickerModal />
      <EffectDecisionModalHosts />
      <DeckRevealOverlay />
      <PublicHandRevealWindow />
      {gameState !== null && (
        <PresentationCoordinatorHost
          speed="standard"
          suppressed={replayDriver.state.log !== null}
        />
      )}
      <VictoryOverlay />
      <TutorialOverlay />
    </>
  );
}
