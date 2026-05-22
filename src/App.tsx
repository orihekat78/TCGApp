// Phase 7 demo + Phase 8.5 store bridge:
// sampleGameState を useGameStateStore に push し、以降は store を真実の源として
// Playmat に渡す。これによって useEngineDispatch 経由の更新が UI に反映される。

import { Playmat } from '@/ui/components/Playmat';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { MulliganModal } from '@/ui/components/MulliganModal';
import { OppTurnOverlay } from '@/ui/components/OppTurnOverlay';
import { SpectatorHUD } from '@/ui/components/SpectatorHUD';
import { ReplayPanel } from '@/ui/components/ReplayPanel';
import { useReplayDriver } from '@/ui/hooks/useReplayDriver';
import type { ReplayLog } from '@/ai/replay';
import { RecentActionToast } from '@/ui/components/RecentActionToast';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { useEffect } from 'react';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { DeckRevealOverlay } from '@/ui/components/DeckRevealOverlay';
import { ContactFlash } from '@/ui/components/ContactFlash';
import { RefreshOverlay } from '@/ui/components/RefreshOverlay';
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
  // user_request 20260521_01 #12: SpectatorHUD が getState() ベースで描画される
  // ため、spectatorMode / aiSpeedMs / isAiPaused / aiStepCounter 変化を親で
  // subscribe して再描画を伝搬する。
  useGameStateStore((s) => s.spectatorMode);
  useGameStateStore((s) => s.aiSpeedMs);
  useGameStateStore((s) => s.isAiPaused);
  useGameStateStore((s) => s.aiStepCounter);
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
  useEffectPickFlowDriver();
  return (
    <>
      <Playmat
        gameState={gameState}
        resolveCard={resolveCard}
        resolveCase={resolveCase}
        resolveHandCard={resolveHandCard}
      />
      <GameSetupModal onLoadReplay={(log) => replayDriver.loadLog(log as ReplayLog)} />
      <ReplayPanel driver={replayDriver} />
      <MulliganModal />
      <OppTurnOverlay />
      <SpectatorHUD />
      <EffectPickerModal />
      <DeckRevealOverlay />
      <RecentActionToast />
      <ContactFlash />
      <RefreshOverlay />
      <VictoryOverlay />
      <TutorialOverlay />
    </>
  );
}
