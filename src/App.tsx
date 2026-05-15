// Phase 7 demo + Phase 8.5 store bridge:
// sampleGameState を useGameStateStore に push し、以降は store を真実の源として
// Playmat に渡す。これによって useEngineDispatch 経由の更新が UI に反映される。

import { Playmat } from '@/ui/components/Playmat';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { OppTurnOverlay } from '@/ui/components/OppTurnOverlay';
import { RecentActionToast } from '@/ui/components/RecentActionToast';
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

export default function App() {
  // Store から購読: dispatch が走ったときに再描画される。
  const gameState = useGameStateStore((s) => s.gameState);
  return (
    <>
      <Playmat
        gameState={gameState}
        resolveCard={resolveCard}
        resolveCase={resolveCase}
        resolveHandCard={resolveHandCard}
      />
      <GameSetupModal />
      <OppTurnOverlay />
      <RecentActionToast />
    </>
  );
}
