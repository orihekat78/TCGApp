// Task 8.4b: 正規 turn-1 GameState 構築
//
// rules: 04-game-setup.md (初期化手順)
//
// engine.flow.setup の正規シーケンスで turn-1 開始状態を作る。
// tests/integration/ai-vs-ai-smoke.test.ts と同じ呼出パターン。
//
// 注: registerAll() (カード def 登録) は App.tsx 起動時に 1 度だけ済んでいる前提。
// 本関数はゲーム開始ボタンクリック毎に呼ばれる。

import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { engine } from '@/engine';
import { resolve } from '@/engine/resolve/index.js';
import { buildMvpDeckPair, buildDeckPair, type DeckId } from './deckBuilder.js';
import { promptMulligan } from '@/ui/hooks/useMulligan.js';
import { BUG_274_PARTNER } from '@/ui/fixtures/bug274PartnerFixture.js';
import type { GameState } from '@/engine/types/game-state';
import type { CardId } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * turn-1 開始の GameState を返す (rules/04)。
 *
 * シーケンス:
 *   1. setup.init: デッキ配置 + validateDeck
 *   2. setup.decideFirstPlayer('random'): 先攻ランダム決定
 *   3. setup.dealOpeningHand × 2: 5 枚ずつドロー
 *   4. setup.reveal: 事件 / パートナー を表向き
 *   5. setup.startGame: signaling ログのみ
 *   6. startTurn(first): 先攻 1 ターン目開始
 *      - turn:start emit / runAutoPhase / phase='main' 遷移 / phase:main:start emit
 *      - runAutoPhase: パートナー active / scene active / 1 ドロー / FILE 1 枚 (rules/04 例外)
 *   7. runAllUntilEmpty: 開幕の effect listener (もしあれば) 解消
 *
 * Round 2 修正: 旧実装は runAutoPhase を直接呼んでいたため state.turn.phase が
 *   'auto' のまま固定され、(a) phase indicator が AUTO で stuck (b) ターン終了 button
 *   が canEndTurn=phase==='main' を満たさず永続 disabled という連鎖バグが発生した。
 *   startTurn を使えば runAutoPhase 後に phase='main' に遷移するため 3 件同時解消。
 *
 * Round 2 改修: マリガン UI を統合した async 版に変更。
 *   - 旧 同期版は 「マリガン自動スキップ」 でゲーム開始 (権利は温存)。
 *   - 新 async 版は rules/04 §5 に従い 「先攻 → 後攻」順に MulliganModal を表示し、
 *     ユーザ選択 (戻すカード ID 配列) を await して engine.flow.setup.mulligan() に渡す。
 *   - 'opp' (CPU) は自動 skip ([]) — AI mulligan policy は Phase 5+ で検討。
 *
 * spec: .claude/specs/2026-05-11-ui-game-setup-flows.md §マリガン
 *
 * @param mulliganProvider テスト/AI 用フック。指定なしならデフォルトの UI prompt を使用。
 *   引数で player と hand を受けて、戻すカード ID 配列を Promise で返す。
 *   テストでは `async () => []` を渡せば skip 動作 (旧同期版と同じ最終状態)。
 */
export type MulliganProvider = (
  player: Player,
  hand: ReadonlyArray<CardId>,
) => Promise<ReadonlyArray<CardId>>;

const defaultMulliganProvider: MulliganProvider = async (player, hand) => {
  if (player === 'self') {
    return promptMulligan({ player, hand });
  }
  // CPU (opp): 自動 skip (Phase 5+ で AI mulligan policy 検討)
  return [];
};

export async function performGameStart(
  mulliganProvider: MulliganProvider = defaultMulliganProvider,
  deckSelection?: { selfDeckId: DeckId; oppDeckId: DeckId },
): Promise<GameState> {
  const decks = deckSelection
    ? buildDeckPair(deckSelection)
    : buildMvpDeckPair();
  const usesBug274Fixture = deckSelection?.selfDeckId === 'TEST-BUG-274'
    || deckSelection?.oppDeckId === 'TEST-BUG-274';
  if (usesBug274Fixture) engine.cards.register(BUG_274_PARTNER);
  // Phase A: init / decideFirstPlayer / dealOpeningHand × 2
  let state = produce(createEmptyGameState(), (draft) => {
    engine.flow.setup.init(draft, decks);
    // The public regression fixture must expose the self partner immediately.
    engine.flow.setup.decideFirstPlayer(
      draft,
      deckSelection?.selfDeckId === 'TEST-BUG-274' ? 'manual' : 'random',
      deckSelection?.selfDeckId === 'TEST-BUG-274' ? 'self' : undefined,
    );
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
  });

  const first = state.turn.player as Player;
  const second: Player = first === 'self' ? 'opp' : 'self';

  // Phase B: マリガン (rules/04 §5 — 先攻先に決定 → 後攻決定)
  for (const p of [first, second] as const) {
    const hand = state.players[p].hand;
    const returns = await mulliganProvider(p, hand);
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
