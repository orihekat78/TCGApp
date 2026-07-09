// CARD PHASE hybrid-batch2 probe — B06018 鬼丸猛 (character, engine変更0)
//
// 印字 (refusedLine, ground truth):
//   【事件YAIBA】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある
//   レベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに
//   〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラが現場にいる場合、
//   このキャラを表向きのまま証拠として得る。」を与える。
//
// DSL (a1): triggered enter/selfOnly, condition caseTrait YAIBA →
//   optional { chain[ discard self 1, sceneEnter from:remove pick{trait YAIBA, levelMax5, char} bind $matched,
//                     charGrantKeyword $matched.uid 突撃 turn,
//                     charGrantAbility $matched.uid { phase:end:start → sceneToEvidence $self faceUp } turn ] }
//
// novel 経路 (compiler refuse):
//  1. 【事件YAIBA】caseTrait gate (cond/eval.ts:97, BUG-124 caseTraits union)
//  2. 【登場時】optional (してもよい) — human chooser 駆動 (drainAiEffectPicks は AI auto-skip)
//  3. リムーブエリア pick → sceneEnter from:remove (levelMax5 / trait YAIBA / kind character filter)
//  4. $matched.uid へ 突撃 (turn) 付与 (charGrantKeyword)
//  5. $matched.uid へ phase:end:start ability 動的付与 → sceneToEvidence $self faceUp
//
// 規約: production dispatch (enter emit → triggered listener)。optional は setHuman('self') +
//   _peekPendingEffectOptionalSide + applyOptionalAndContinuation (B04058 pilot 慣行)。
//   inner pick は human 所有ゆえ _drainAllEffectPicksForTest で駆動。
//   BUG-174: 本カードの pick は side:self 固定 (自分のリムーブ) → opp 側に valid YAIBA を置き
//   候補に入らない (cross-side bleed 無し) ことを pin。decoy: lv6 / 非YAIBA を候補除外 assert。
//
// rules: 05 (phase:end:start), 13 (突撃), 15 (「〜まで」=0可 / してもよい / そうした場合), 17 (【事件色/特徴】条件)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B06018 } from '@/cards/ct-p06/B06018';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

const FIXTURES: CardDef[] = [
  def('YCASE', { kind: 'case', caseTraits: ['YAIBA'] }),   // 【事件YAIBA】成立
  def('PCASE', { kind: 'case', caseTraits: [] }),          // 非YAIBA 事件 (condition gate decoy)
  def('YMEMBER', { traits: ['YAIBA'], level: 5 }),         // pick 対象 (YAIBA lv5 char)
  def('OPPY', { traits: ['YAIBA'], level: 5 }),            // 相手リムーブの YAIBA lv5 (side:self ゆえ候補外, BUG-174)
  def('YHIGH', { traits: ['YAIBA'], level: 6 }),           // decoy: levelMax5 で除外
  def('NONY', { traits: [] }),                             // decoy: 特徴YAIBA でない
  def('HANDCARD'),                                         // discard 対象
  def('FILL'),
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

// B06018 を現場に登場させ enter emit (production 形 = B03098 pilot 慣行 / hand-use-card と同 payload)
function enterOni(s0: GameState): GameState {
  return produce(s0, (d) => {
    const c = mutateAll.scene.enter(d, 'self', 'B06018', {});
    event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn }, { player: 'self', cardId: 'B06018', uid: c.uid });
    runAllUntilEmpty(d);
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B06018, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// 1. 【事件YAIBA】condition gate (caseTrait)
// ============================================================
describe('B06018 a1 — 【事件YAIBA】caseTrait gate', () => {
  it('事件が特徴YAIBA → 登場時 optional が surface する', () => {
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD'];
    s.players.self.remove = ['YMEMBER'];
    const after = enterOni(s);
    expect(_peekPendingEffectOptionalSide(), '【事件YAIBA】成立 → してもよい surface').not.toBeNull();
    void after;
  });
  it('事件が特徴YAIBA を持たない → 発動しない (rules/17 条件外は持たない扱い)', () => {
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'PCASE'; // 非YAIBA
    s.players.self.hand = ['HANDCARD'];
    s.players.self.remove = ['YMEMBER'];
    const after = enterOni(s);
    expect(_peekPendingEffectOptionalSide(), '非YAIBA 事件では surface しない').toBeNull();
    expect(after.players.self.hand.length, '手札不変').toBe(1);
    expect(after.players.self.remove).toEqual(['YMEMBER']);
  });
});

// ============================================================
// 2. する (yes) — discard1 → YAIBA lv5 登場 + 突撃 (turn)、decoy 除外、cross-side 遮断
// ============================================================
describe('B06018 a1 — する: discard → sceneEnter(remove) + 突撃 付与', () => {
  function board() {
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD', 'FILL'];
    // self.remove: 対象1(YMEMBER) + decoy lv6(YHIGH) + decoy 非YAIBA(NONY)
    s.players.self.remove = ['YMEMBER', 'YHIGH', 'NONY'];
    // opp.remove: valid YAIBA lv5 だが query side:self ゆえ候補に入らない (BUG-174 cross-side pin)
    s.players.opp.remove = ['OPPY'];
    s.players.self.scene = [];
    return s;
  }
  function runYes(s0: GameState): GameState {
    setHuman('self');
    return produce(enterOni(s0), (d) => {
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
  }
  it('YAIBA lv5 が現場に登場 + 突撃 (turn) 付与', () => {
    const after = runYes(board());
    const entered = after.players.self.scene.find(c => c.cardId === 'YMEMBER');
    expect(entered, 'YMEMBER 登場').toBeTruthy();
    expect(readChar.hasKeyword(after, entered!.uid, '突撃'), '登場キャラに突撃 (turn)').toBe(true);
  });
  it('手札 -1 (discard) + 登場カードは remove から除去', () => {
    const after = runYes(board());
    expect(after.players.self.hand.length, '手札 -1 (discard)').toBe(1);
    expect(after.players.self.remove.includes('YMEMBER'), '登場した YMEMBER は remove から消える').toBe(false);
  });
  it('decoy 除外: lv6(YHIGH)/非YAIBA(NONY) は登場せず remove に残る', () => {
    const after = runYes(board());
    expect(after.players.self.scene.some(c => c.cardId === 'YHIGH'), 'lv6 は登場不可').toBe(false);
    expect(after.players.self.scene.some(c => c.cardId === 'NONY'), '非YAIBA は登場不可').toBe(false);
    expect(after.players.self.remove.includes('YHIGH')).toBe(true);
    expect(after.players.self.remove.includes('NONY')).toBe(true);
  });
  it('cross-side 遮断: 相手リムーブの YAIBA lv5(OPPY) は候補外 (side:self, BUG-174)', () => {
    const after = runYes(board());
    expect(after.players.opp.remove.includes('OPPY'), '相手 remove に残存').toBe(true);
    expect(after.players.opp.scene.some(c => c.cardId === 'OPPY'), '相手現場に登場しない').toBe(false);
    expect(after.players.self.scene.some(c => c.cardId === 'OPPY'), '自分現場にも来ない').toBe(false);
  });
});

// ============================================================
// 3. ターン終了時ability: phase:end:start → 表向き証拠として得る (charGrantAbility → sceneToEvidence faceUp)
// ============================================================
describe('B06018 a1 — 付与 phase:end:start → sceneToEvidence faceUp', () => {
  function toEndPhase(s0: GameState): GameState {
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD'];
    s.players.self.remove = ['YMEMBER'];
    s.players.self.scene = [];
    void s0;
    const afterEnter = produce(enterOni(s), (d) => {
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    // production 形 = flow/turn.ts:72 event.emit(state,'phase:end:start',{player:p},undefined)
    return produce(afterEnter, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
    });
  }
  it('現場にいる → 表向き証拠として得る (scene から離脱 + evidence faceUp)', () => {
    const after = toEndPhase(base());
    expect(after.players.self.scene.some(c => c.cardId === 'YMEMBER'), 'YMEMBER は現場を離れる').toBe(false);
    const evd = after.players.self.evidence.find(e => e.cardId === 'YMEMBER');
    expect(evd, 'YMEMBER が証拠に').toBeTruthy();
    expect(evd!.faceUp, '表向きのまま').toBe(true);
  });
  it('登場キャラが現場を離れていた → 証拠として得ない (現場にいる場合 gate)', () => {
    // 登場 → phase:end:start 前に YMEMBER を現場から除去 → granted ability は scan 対象外
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD'];
    s.players.self.remove = ['YMEMBER'];
    s.players.self.scene = [];
    const afterEnter = produce(enterOni(s), (d) => {
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    const entered = afterEnter.players.self.scene.find(c => c.cardId === 'YMEMBER')!;
    const afterLeave = produce(afterEnter, (d) => {
      mutateAll.scene.removeToRemove(d, entered.uid, 'effect');
    });
    const after = produce(afterLeave, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.evidence.some(e => e.cardId === 'YMEMBER'), '現場に居ない → 証拠にならない').toBe(false);
  });
});

// ============================================================
// 4. しない (no) — discard も登場も起きない
// ============================================================
describe('B06018 a1 — しない: 何も起きない', () => {
  it('optional=false → 手札/リムーブ不変・現場は B06018 のみ', () => {
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD', 'FILL'];
    s.players.self.remove = ['YMEMBER'];
    const after = produce(enterOni(s), (d) => {
      const p = _peekPendingEffectOptionalSide();
      expect(p).not.toBeNull();
      applyOptionalAndContinuation(d, p!, false);
    });
    expect(after.players.self.hand.length, '手札不変').toBe(2);
    expect(after.players.self.remove, 'リムーブ不変').toEqual(['YMEMBER']);
    expect(after.players.self.scene.length, '現場は B06018 のみ').toBe(1);
    expect(after.players.self.scene[0].cardId).toBe('B06018');
  });
});

// ============================================================
// 5. edge — する が YAIBA 対象不在: discard は起きるが登場は 0枚 (「1枚まで」=0可)
// ============================================================
describe('B06018 a1 — する だが対象不在: discard のみ・登場なし', () => {
  it('remove に有効 YAIBA なし (decoy のみ) → 手札 -1 だが登場は起きない', () => {
    setHuman('self');
    const s = base();
    s.players.self.case.cardId = 'YCASE';
    s.players.self.hand = ['HANDCARD'];
    s.players.self.remove = ['YHIGH', 'NONY']; // lv6 と 非YAIBA のみ (候補 0)
    s.players.self.scene = [];
    const after = produce(enterOni(s), (d) => {
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, '手札 -1 (discard 済)').toBe(0);
    const newChars = after.players.self.scene.filter(c => c.cardId !== 'B06018');
    expect(newChars.length, '登場キャラなし (「1枚まで」=0可)').toBe(0);
    expect(after.players.self.remove.includes('YHIGH')).toBe(true);
    expect(after.players.self.remove.includes('NONY')).toBe(true);
  });
});
