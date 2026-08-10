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
import { defaultCaseForPartner } from '../data/cardPool';
import { BUG_274_PARTNER } from '@/ui/fixtures/bug274PartnerFixture.js';
import { BUG_274_PARTNER_ID } from '../data/bug274ValidationDeck';
import { startCausalSession } from '@/engine/log/causal';

/** meta DeckRecord → engine Deck 変換 (mainCards を count 分展開) */
export function toEngineDeck(deck: DeckRecord) {
  const mainCards: string[] = [];
  for (const e of deck.cards) {
    for (let i = 0; i < e.count; i++) mainCards.push(e.num);
  }
  return {
    partnerId: deck.partner,
    // デッキの事件スロットを使う。未設定の旧デッキはパートナーから推定。
    caseId: deck.case || defaultCaseForPartner(deck.partner),
    mainCards,
  };
}

/** カスタム DeckRecord ペアから実機対戦 GameState を生成 (src/services/gameStarter のミラー)。
 *  - spectator=true (観察ルーム) のときは両者 AI なので人間マリガンを出さない。
 *  - firstPlayer 指定時は先攻を固定 (未指定ならランダム)。 */
export async function customGameStart(
  selfDeck: DeckRecord,
  oppDeck: DeckRecord,
  opts: {
    sessionId: string;
    spectator?: boolean;
    firstPlayer?: 'self' | 'opp';
    /** False when the route/session owner has cancelled this start. */
    isSessionCurrent?: () => boolean;
  },
): Promise<GameState> {
  const assertSessionCurrent = (): void => {
    if (opts.isSessionCurrent?.() === false) {
      throw new Error('customGameStart: match session cancelled');
    }
  };

  assertSessionCurrent();
  const decks: DeckPair = {
    self: toEngineDeck(selfDeck),
    opp:  toEngineDeck(oppDeck),
  };
  if (selfDeck.partner === BUG_274_PARTNER_ID || oppDeck.partner === BUG_274_PARTNER_ID) {
    engine.cards.register(BUG_274_PARTNER);
  }

  // Phase A: init / decideFirstPlayer / dealOpeningHand × 2
  let state = produce(createEmptyGameState(), (draft) => {
    startCausalSession(draft, opts.sessionId);
    engine.flow.setup.init(draft, decks);
    if (opts.firstPlayer) engine.flow.setup.decideFirstPlayer(draft, 'manual', opts.firstPlayer);
    else engine.flow.setup.decideFirstPlayer(draft, 'random');
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
  });
  assertSessionCurrent();

  const first = state.turn.player as 'self' | 'opp';
  const second: 'self' | 'opp' = first === 'self' ? 'opp' : 'self';

  // Phase B: mulligan (先攻 → 後攻)。観戦モードでは人間操作が無いので self も自動 skip。
  for (const p of [first, second] as const) {
    assertSessionCurrent();
    const hand = state.players[p].hand;
    const isHuman = !opts.spectator && p === 'self';
    const returns = isHuman ? await promptMulligan({ player: p, hand }) : [];
    // endMatchSession settles the prompt. Re-check before mutating the stale
    // local state, otherwise the cancelled start can still enter Phase C.
    assertSessionCurrent();
    state = produce(state, (draft) => {
      engine.flow.setup.mulligan(draft, p, [...returns]);
    });
  }

  // Phase C: reveal → startGame → startTurn(first)
  assertSessionCurrent();
  state = produce(state, (draft) => {
    engine.flow.setup.reveal(draft);
    engine.flow.setup.startGame(draft);
    engine.flow.startTurn(draft, first);
    resolve.runAllUntilEmpty(draft);
  });

  return state;
}
