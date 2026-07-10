// tests/cards/night-wA4/B05097 鮫崎島治 — Wave A 刈り取り card probe (2026-07-11)
//   a1 相手はリフレッシュによって証拠を得られない (continuous opponentRestrict['refreshEvidence'])。
//   a2 【宣言】自分のデッキを上から5枚までリムーブ (枚数を決めてからリムーブ) = choice{ mill n:0..5 }。
//      choice option 実行で mill 数一致 + 0 選択 (何もしない) を検証。
// rules: 14 / 15 / 17 / 21 / 26

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { sceneChar } from '../../helpers/fixtures';
import { B05097 } from '@/cards/ct-p05/B05097';
import type { EffectCtx, GameState } from '@/engine/types';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(B05097);
  registerTriggeredListener();
});

function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** a2 choice を choiceIndex 指定で駆動 (index = リムーブ枚数)。 */
function runMillChoice(index: number, deckLen: number): GameState {
  let s = createEmptyGameState();
  turnSelf(s);
  s.players.self.scene = [sceneChar('B05097', 'same#1')];
  s.players.self.deck = Array.from({ length: deckLen }, (_, i) => `D${i}`);
  const ab = B05097.abilities.find((a) => a.id === 'a2')!;
  s = produce(s, (d) => {
    const ctx = {
      source: { player: 'self', cardId: 'B05097', uid: 'same#1', abilityId: 'a2', area: 'scene' },
      bindings: {}, dyn: { choiceIndex: index },
    } as unknown as EffectCtx;
    runEffect(d, ab.effect as never, ctx);
    runAllUntilEmpty(d);
  });
  return s;
}

describe('B05097 a2 — mill-choice (枚数を決めてからリムーブ)', () => {
  it('index 3 を選ぶ → デッキ上3枚リムーブ (deck 10→7, remove +3)', () => {
    const s = runMillChoice(3, 10);
    expect(s.players.self.deck.length, 'deck 7').toBe(7);
    expect(s.players.self.remove.length, 'remove +3').toBe(3);
  });

  it('index 5 (最大) を選ぶ → 5枚リムーブ', () => {
    const s = runMillChoice(5, 10);
    expect(s.players.self.deck.length, 'deck 5').toBe(5);
    expect(s.players.self.remove.length, 'remove +5').toBe(5);
  });

  it('index 0 を選ぶ → 何もリムーブしない (0枚可)', () => {
    const s = runMillChoice(0, 10);
    expect(s.players.self.deck.length, 'deck 不変').toBe(10);
    expect(s.players.self.remove.length, 'remove 0').toBe(0);
  });
});

describe('B05097 a1 — 相手はリフレッシュによって証拠を得られない (opponentRestrict refreshEvidence)', () => {
  it('鮫崎島治が自分の現場にいると、自分のリフレッシュで相手は証拠を得ない', () => {
    let s = createEmptyGameState();
    turnSelf(s);
    s.players.self.scene = [sceneChar('B05097', 'same#1')];
    // リフレッシュ成立に remove に 1 枚 (0枚だと敗北)。deck は 0。
    s.players.self.deck = [];
    s.players.self.remove = ['X'];
    const before = s.players.opp.evidence.length;
    s = produce(s, (d) => { mutate.deck.refresh(d, 'self'); });
    expect(s.players.opp.evidence.length, '相手は証拠を得ない (penalty 抑止)').toBe(before);
  });

  it('鮫崎島治が不在なら通常通り相手は証拠を得る', () => {
    let s = createEmptyGameState();
    turnSelf(s);
    s.players.self.deck = [];
    s.players.self.remove = ['X'];
    const before = s.players.opp.evidence.length;
    s = produce(s, (d) => { mutate.deck.refresh(d, 'self'); });
    expect(s.players.opp.evidence.length, '通常は相手 +1').toBe(before + 1);
  });
});
