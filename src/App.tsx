// Phase 7 demo + Phase 8.5 store bridge:
// sampleGameState を useGameStateStore に push し、以降は store を真実の源として
// Playmat に渡す。これによって useEngineDispatch 経由の更新が UI に反映される。

import { Playmat } from '@/ui/components/Playmat';
import {
  createCardResolver,
  createCaseResolver,
  createHandCardResolver,
} from '@/ui/services/cardResolvers';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { useGameStateStore } from '@/ui/state/store.js';
import '@/ui/styles/tokens.css';

import ctD08 from '../ct-d08-cards.json';
import ctD11 from '../ct-d11-cards.json';

const resolveCard = createCardResolver(ctD08 as never, ctD11 as never);
const resolveCase = createCaseResolver(ctD08 as never, ctD11 as never);
const resolveHandCard = createHandCardResolver(ctD08 as never, ctD11 as never);

// 起動時に store を初期化 (一度だけ — null チェックで HMR にも耐える)
if (useGameStateStore.getState().gameState === null) {
  useGameStateStore.getState().setGameState(createSampleGameState());
}

export default function App() {
  // Store から購読: dispatch が走ったときに再描画される。
  const gameState = useGameStateStore((s) => s.gameState);
  return (
    <Playmat
      gameState={gameState}
      resolveCard={resolveCard}
      resolveCase={resolveCase}
      resolveHandCard={resolveHandCard}
    />
  );
}
