// Phase 7 demo: Playmat 統合 + cards.json (CT-D08 + CT-D11) からの
// resolveCard / resolveCase 接続 + sampleGameState fixture 表示。
// Phase 8 で実際の操作系を実装する際の足場。

import { Playmat } from '@/ui/components/Playmat';
import {
  createCardResolver,
  createCaseResolver,
  createHandCardResolver,
} from '@/ui/services/cardResolvers';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import '@/ui/styles/tokens.css';

import ctD08 from '../ct-d08-cards.json';
import ctD11 from '../ct-d11-cards.json';

const resolveCard = createCardResolver(ctD08 as never, ctD11 as never);
const resolveCase = createCaseResolver(ctD08 as never, ctD11 as never);
const resolveHandCard = createHandCardResolver(ctD08 as never, ctD11 as never);
const sampleState = createSampleGameState();

export default function App() {
  return (
    <Playmat
      gameState={sampleState}
      resolveCard={resolveCard}
      resolveCase={resolveCase}
      resolveHandCard={resolveHandCard}
    />
  );
}
