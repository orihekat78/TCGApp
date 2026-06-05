// engine-extension look-top-N batch (2026-06-06 タスクC) — D01012 灰原哀
//
// 検証: 【相手ターン中】【現場リムーブ時】(leave:to-remove + turn:opp) で デッキ上3枚から
//   レベル4以下【青】キャラを1枚まで **スリープ状態で登場** (sceneEnter enterSleep:true)、残りデッキ下。
//   decoy (青Lv5 / 緑Lv3) は filter (levelMax:4 / color:青) で除外されることを確認。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { GameState, SceneCharacter } from '@/engine/types';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

describe('look-top-N D01012 (enterSleep) — 2026-06-06', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
  });

  it('相手ターン中の現場リムーブで デッキ上3枚から[青]Lv≤4 (D01013) をスリープ登場 / decoy 除外', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
    s.players.self.scene = [sceneChar('D01012', 'hai#1')];
    // deck top3: D01013(青Lv4=正) / D08009(青Lv5=level decoy) / D02009(緑Lv3=color decoy)
    s.players.self.deck = ['D01013', 'D08009', 'D02009'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'hai#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    const entered = s.players.self.scene.find((c) => c.cardId === 'D01013');
    expect(entered, '[青]Lv4 の D01013 が現場に登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.deck, 'D01013 はデッキから抜けた').not.toContain('D01013');
    expect(s.players.self.deck, '青Lv5 decoy D08009 は登場せずデッキに残る').toContain('D08009');
    expect(s.players.self.deck, '緑Lv3 decoy D02009 は登場せずデッキに残る').toContain('D02009');
  });

  it('turn:self では発火しない (【相手ターン中】gate)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false }; // 自分ターン
    s.players.self.scene = [sceneChar('D01012', 'hai#1')];
    s.players.self.deck = ['D01013', 'D08009', 'D02009'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'hai#1', 'effect');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'D01013'), '自分ターンでは登場しない').toBeFalsy();
    expect(s.players.self.deck, 'D01013 はデッキに残る').toContain('D01013');
  });
});
