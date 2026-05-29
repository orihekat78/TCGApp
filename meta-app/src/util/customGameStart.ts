// spec: .claude/specs/meta-ui/13-implementations.md
// Phase 14-A: 任意の meta DeckRecord を engine Deck に変換して実機対戦を開始
// performGameStart (src/) は DeckId 専用なので、その内部ロジックをミラーして DeckPair を直接受ける

import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { engine } from '@/engine';
import { resolve } from '@/engine/resolve/index.js';
import { promptMulligan } from '@/ui/hooks/useMulligan.js';
import type { GameState } from '@/engine/types/game-state';
import type { DeckPair } from '@/engine/flow/setup';
import type { DeckRecord } from '../data/types';
import { CARD_POOL } from '../data/cardPool';

/** パートナー → 事件カード対応 (色を頼りに推定) */
const PARTNER_TO_CASE: Record<string, string> = {
  D08001: 'D08026', D08002: 'D08026',  // CT-D08 → 青の古城探索事件
  D11001: 'D11021', D11002: 'D11021',  // CT-D11 → 千速と重悟の婚活パーティー
};

/** パートナーから caseId を推定。未登録なら color から fallback */
function inferCaseId(partnerNum: string): string {
  if (PARTNER_TO_CASE[partnerNum]) return PARTNER_TO_CASE[partnerNum]!;
  const partner = CARD_POOL.find((c) => c.num === partnerNum);
  if (partner?.color === 'yellow') return 'D11021';
  return 'D08026';
}

/** meta DeckRecord → engine Deck 変換 (mainCards を count 分展開) */
export function toEngineDeck(deck: DeckRecord) {
  const mainCards: string[] = [];
  for (const e of deck.cards) {
    for (let i = 0; i < e.count; i++) mainCards.push(e.num);
  }
  return {
    partnerId: deck.partner,
    caseId: inferCaseId(deck.partner),
    mainCards,
  };
}

/** カスタム DeckRecord ペアから実機対戦 GameState を生成 (src/services/gameStarter のミラー) */
export async function customGameStart(
  selfDeck: DeckRecord,
  oppDeck: DeckRecord,
): Promise<GameState> {
  const decks: DeckPair = {
    self: toEngineDeck(selfDeck),
    opp:  toEngineDeck(oppDeck),
  };

  // Phase A: init / decideFirstPlayer / dealOpeningHand × 2
  let state = produce(createEmptyGameState(), (draft) => {
    engine.flow.setup.init(draft, decks);
    engine.flow.setup.decideFirstPlayer(draft, 'random');
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
  });

  const first = state.turn.player as 'self' | 'opp';
  const second: 'self' | 'opp' = first === 'self' ? 'opp' : 'self';

  // Phase B: mulligan (先攻 → 後攻 / CPU は自動 skip)
  for (const p of [first, second] as const) {
    const hand = state.players[p].hand;
    const returns = p === 'self' ? await promptMulligan({ player: p, hand }) : [];
    state = produce(state, (draft) => {
      engine.flow.setup.mulligan(draft, p, [...returns]);
    });
  }

  // Phase C: reveal → startGame → startTurn(first)
  state = produce(state, (draft) => {
    engine.flow.setup.reveal(draft);
    engine.flow.setup.startGame(draft);
    engine.flow.startTurn(draft, first);
    resolve.runAllUntilEmpty(draft);
  });

  return state;
}
