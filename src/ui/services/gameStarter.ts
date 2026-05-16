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
import { buildMvpDeckPair } from './deckBuilder.js';
import type { GameState } from '@/engine/types/game-state';

/**
 * turn-1 開始の GameState を返す (rules/04)。
 *
 * シーケンス:
 *   1. setup.init: デッキ配置 + validateDeck
 *   2. setup.decideFirstPlayer('random'): 先攻ランダム決定
 *   3. setup.dealOpeningHand × 2: 5 枚ずつドロー
 *   4. setup.reveal: 事件 / パートナー を表向き
 *   5. setup.startGame: signaling ログのみ
 *   6. runAutoPhase(first): 先攻 1 ターン目のオートフェイズ
 *      - パートナー active / scene active / 1 ドロー / FILE 1 枚 (rules/04 例外)
 *   7. runAllUntilEmpty: 開幕の effect listener (もしあれば) 解消
 *
 * 注: マリガン UI は MVP では出さない (Task 8.4 後続)。
 * 自動的にマリガン権を温存 (mulligan を呼ばないので mulliganUsed は false のまま)。
 */
export function performGameStart(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    engine.flow.setup.init(draft, buildMvpDeckPair());
    engine.flow.setup.decideFirstPlayer(draft, 'random');
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
    engine.flow.setup.reveal(draft);
    engine.flow.setup.startGame(draft);
    const first = draft.turn.player;
    engine.flow.runAutoPhase(draft, first);
    resolve.runAllUntilEmpty(draft);
  });
}
