// engine-extension triggerChar→target batch (2026-06-06 タスクC) — $trigger.uid で「そのキャラ」を
// effect target にする機構 + B05080 羽田秀吉 を実カード経由で検証。
//
// 検証: reasoning:end の payload (推理キャラ) を resolveBindRef('$trigger.uid') が解決し、
//   chain([discard{max:1}, charModifyLP{uid:'$trigger.uid'}]) が「そのキャラ」に LP-1 を適用する。
//   discard が skip/no-candidate (chain break) のときは LP-1 しない (「そうした場合」)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B05080 } from '@/cards/ct-p05/B05080';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';

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

// 相手の推理キャラ (lp:2 → LP-1 turn で 1 になる)
const REASONER: CardDef = {
  id: 'REASONER_T', no: 'NO', kind: 'character', names: ['敵推理キャラ'], colors: ['青'],
  level: 5, ap: 5000, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function setHuman(side: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
}

describe('engine-extension triggerChar→target batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    registerCardDef(REASONER);
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  it('card def: a1=misread / a2=reasoning:end + triggerCharMatches opp + chain', () => {
    expect(B05080.abilities[0].type).toBe('icon-misread');
    expect(B05080.abilities[1].trigger).toMatchObject({
      hook: 'reasoning:end',
      matcherCondition: { kind: 'triggerCharMatches', side: 'opp' },
    });
    expect((B05080.abilities[1].effect as { kind: string }).kind).toBe('chain');
  });

  it('相手キャラ推理 → 手札1枚リムーブ + そのキャラ ($trigger.uid) を LP-1', () => {
    const policy = new HeuristicPolicy();
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05080', 'hyd#1')];
    s.players.self.hand = ['D08005']; // discard 用
    s.players.opp.scene = [sceneChar('REASONER_T', 'enemy#1')];
    s.players.opp.deck = ['D08005', 'D08006', 'D08009']; // 推理 LP2 で 2 枚 + 余裕
    s = produce(s, (d) => {
      doReasoning(d, 'enemy#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    expect(s.players.self.hand, '手札 D08005 がリムーブされた').not.toContain('D08005');
    expect(readChar.lp(s, 'enemy#1'), 'そのキャラ (推理した相手) を LP-1 (2→1)').toBe(1);
  });

  it('手札0枚 → discard no-candidate で chain break (LP-1 しない =「そうした場合」)', () => {
    const policy = new HeuristicPolicy();
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05080', 'hyd#1')];
    s.players.self.hand = []; // discard 不能
    s.players.opp.scene = [sceneChar('REASONER_T', 'enemy#1')];
    s.players.opp.deck = ['D08005', 'D08006', 'D08009'];
    s = produce(s, (d) => {
      doReasoning(d, 'enemy#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    expect(readChar.lp(s, 'enemy#1'), '手札0枚 (リムーブ不能) なら LP-1 しない (2 のまま)').toBe(2);
  });

  it('自分のキャラ推理では不発 (side:opp gate)', () => {
    const policy = new HeuristicPolicy();
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05080', 'hyd#1'), sceneChar('REASONER_T', 'mine#1')];
    s.players.self.hand = ['D08005'];
    s.players.self.deck = ['D08005', 'D08006', 'D08009'];
    s = produce(s, (d) => {
      doReasoning(d, 'mine#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    expect(s.players.self.hand, '自分側推理では発火せず 手札も減らない').toContain('D08005');
    expect(readChar.lp(s, 'mine#1'), '自分側推理では LP-1 不発').toBe(2);
  });
});
