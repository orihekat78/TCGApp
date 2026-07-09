// CARD PHASE hybrid-batch2 probe — B02062 世良真純 (character)
// novel 句 (compiler refusedLine, col=effect):
//   「【自分ターン中】【ターン1】相手の証拠がリムーブされたとき、カードを1枚引く。」
//   = a1: triggered hook 'evidence:removed'
//        matcherCondition triggerPlayerIs{side:'opp'}  ← 相手の証拠 (持ち主側 gate)
//        condition turn{self}  ← 【自分ターン中】
//        limit turn{n:1}       ← 【ターン1】
//        effect draw{n:1, player:'self'}
// (a2 ヒラメキ draw = compiledRest 既製 = compiler が出した行、novel でない → 本 probe 対象外)
//
// production emit 経路 = mutate/evidence.ts:42/56/94 removeTop/removeAt/toRemove が
//   `event.emit(s, 'evidence:removed', { player: p })` を発火 (原因非依存、公式Q&A:
//   「アクション以外のリムーブでも発動する」)。fake emit を避け removeTop を直接叩く。
// side gate: cond/eval.ts:249 triggerPlayerIs → payload.player !== source.player で side:'opp' 成立。
//   B02062 は self 所有 → opp の証拠 (payload.player='opp') 除去で発火 / self の証拠除去では不発。
// BUG-174: a1 に pick は無いが「相手側の証拠」= owner=opp 相当を positive で pin。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef, EvidenceCard } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B02062 } from '@/cards/ct-p02/B02062';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// filter 条件外の decoy キャラ (a1 を持たない普通キャラ) — 除去観測に反応しないこと確認用
const DECOY = def('DECOY');

function base(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2', 'DK3'];
  s.players.opp.deck = ['OD1', 'OD2', 'OD3'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  for (const d of [B02062, DECOY]) registerCardDef(d);
  registerTriggeredListener();
});

// production 除去: mutate/evidence.removeTop → evidence:removed{player} emit
const removeTop = (s0: GameState, owner: 'self' | 'opp') => produce(s0, (d) => {
  mutateAll.evidence.removeTop(d, owner);
  runAllUntilEmpty(d);
});

describe('B02062 a1 — 相手証拠リムーブ観測 → 自分ターン中1回 draw1', () => {
  function board(turnPlayer: 'self' | 'opp' = 'self') {
    const s = base(turnPlayer);
    s.players.self.scene = [sc('B02062', 'sera'), sc('DECOY', 'dc')];
    s.players.self.evidence = [ev('SE1'), ev('SE2')];
    s.players.opp.evidence = [ev('OE1'), ev('OE2')];
    return s;
  }

  it('自分ターン中に相手証拠が除去 → self が1枚 draw (deck-1 / hand+1)', () => {
    const after = removeTop(board('self'), 'opp'); // owner=opp の証拠除去 (BUG-174 pin)
    expect(after.players.self.hand.length, '相手証拠除去 → 1枚引く').toBe(1);
    expect(after.players.self.deck.length, 'deck から1枚減る').toBe(2);
    expect(after.players.opp.evidence.length, '相手証拠1つ減').toBe(1);
  });

  it('自分の証拠が除去された場合 → 不発 (triggerPlayerIs side:opp gate)', () => {
    const after = removeTop(board('self'), 'self');
    expect(after.players.self.hand.length, '自証拠除去では draw しない').toBe(0);
    expect(after.players.self.deck.length).toBe(3);
  });

  it('相手ターン中に相手証拠が除去 → 不発 (【自分ターン中】condition turn:self)', () => {
    const after = removeTop(board('opp'), 'opp');
    expect(after.players.self.hand.length, '相手ターンでは draw しない').toBe(0);
    expect(after.players.self.deck.length).toBe(3);
  });

  it('【ターン1】: 同一ターンに相手証拠を2回除去 → draw は1回のみ', () => {
    const after = produce(board('self'), (d) => {
      mutateAll.evidence.removeTop(d, 'opp'); // 1回目 → 発動記録
      runAllUntilEmpty(d);
      mutateAll.evidence.removeTop(d, 'opp'); // 2回目 → limit 到達で不発
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, '2回除去でも draw は1回').toBe(1);
    expect(after.players.self.deck.length).toBe(2);
    expect(after.players.opp.evidence.length, '証拠は2つとも除去済').toBe(0);
  });

  it('B02062 が現場に居ない (DECOY のみ) → 相手証拠除去でも不発 (scope on-scene)', () => {
    const s = base('self');
    s.players.self.scene = [sc('DECOY', 'dc')];
    s.players.opp.evidence = [ev('OE1')];
    const after = removeTop(s, 'opp');
    expect(after.players.self.hand.length, 'listener 不在 → draw しない').toBe(0);
  });
});
