// CARD PHASE hybrid-batch2 probe — B09022 遠山和葉 (character, engine変更0)
//
// 印字 (ground truth):
//   a1【パートナー緑】【解決編】【登場時】自分の現場にいるレベル6以上の〚特徴［探偵］〛のキャラを
//     1枚スリープさせ、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、
//     リムーブする。この効果によって〚カード名［服部平次］〛か〚［江戸川コナン］〛をスリープさせた場合、
//     カードを1枚引く。
//   a2 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//
// DSL:
//   a1 = triggered enter/selfOnly + condition and[partnerColor:緑, caseStatus:解決編] →
//        optional{ chain[ sceneSetState{sleep, side:self, filter{char,trait探偵,levelMin6}, n:1, bind:$slept},
//                          discard self 1,
//                          sceneRemove{max:1, side:either, filter{char,levelMax7}},
//                          conditional{ if boundMatchesFilter($slept, cardName[服部平次,江戸川コナン]) → draw 1 } ] }
//   a2 = triggered leave:to-remove + condition removedCharMatches{side:opp, cause:contact-ap, by:self} → draw 1
//
// 駆動規約:
//   a1 = production dispatch (enter emit → triggered listener)。optional は setHuman('self') +
//        _peekPendingEffectOptionalSide + applyOptionalAndContinuation (B06018/B04058 慣行)。
//        inner pick は human 所有ゆえ _drainAllEffectPicksForTest。sceneRemove(side:either) の候補には
//        source(遠山和葉 lv6)自身も入る (印字 lv≤7) ため、policy chooseAtomTarget で opp 候補を選び
//        「相手キャラを除去できる/lv8 decoy 除外」を pin する。
//   a2 = cluster15 driver (mutate.scene.removeToRemove(uid, 'contact-ap', byUid))。observerFired =
//        pendingEffects に leave:to-remove の source=B09022 が queue されたか。
//
// rules: 03 (状態), 07/08 (コンタクト), 15 (「〜まで」=0可 / してもよい / そうした場合), 17 (条件アイコン),
//        19 (複数名カード名), 22 (contact-ap 除去タイミング)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import {
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef, Candidate } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B09022 } from '@/cards/ct-p09/B09022';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

// sceneRemove(side:either) の候補確定用: sceneRemove の時だけ opp 側候補を選ぶ (それ以外は null=先頭 fallback)。
const pickOppForRemove = {
  chooseAtomTarget: (_s: GameState, verb: string, _a: Readonly<Record<string, unknown>>, cands: ReadonlyArray<Candidate>): Candidate | null =>
    verb === 'sceneRemove'
      ? (cands.find((c) => (c as { player?: string }).player === 'opp') ?? null)
      : null,
};

const FIXTURES: CardDef[] = [
  def('GPARTNER', { kind: 'partner', names: ['和葉パートナー'], colors: ['緑'] }), // partnerColor緑 成立
  def('RPARTNER', { kind: 'partner', names: ['非緑パートナー'], colors: ['赤'] }), // 非緑 decoy
  def('HATTORI', { names: ['服部平次'], traits: ['探偵'], level: 8 }),   // named 探偵 lv8 (sleep可 / sceneRemove除外)
  def('DETECTIVE', { names: ['刑事甲'], traits: ['探偵'], level: 6 }),   // 非named 探偵 lv6 (sleep可)
  def('DET5', { names: ['探偵乙'], traits: ['探偵'], level: 5 }),        // 探偵 lv5 (levelMin6 で候補外)
  def('TGT', { level: 5 }),                                             // opp sceneRemove target (lv≤7)
  def('DECOY', { level: 8 }),                                           // opp lv8 = levelMax7 除外 decoy
  def('VIC', { level: 3 }),                                             // a2 victim
  def('OTHER', { level: 3 }),                                           // a2 別の除去者 (by:self pin)
  def('HAND1'),                                                         // discard 対象
  def('DRAWN'), def('FILL'),                                            // deck fill
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: 'GPARTNER', state: 'active', location: 'partner-area' };
  s.players.self.case.status = '解決編';
  s.players.self.deck = ['DRAWN', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

// B09022 を現場に登場させ enter emit (B06018 pilot 慣行)
function enterWakaba(s0: GameState): GameState {
  return produce(s0, (d) => {
    const c = mutateAll.scene.enter(d, 'self', 'B09022', {});
    event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn }, { player: 'self', cardId: 'B09022', uid: c.uid });
    runAllUntilEmpty(d);
  });
}

function takeAndDrain(afterEnter: GameState): GameState {
  return produce(afterEnter, (d) => {
    const p = _peekPendingEffectOptionalSide();
    expect(p, 'optional surface (human self)').not.toBeNull();
    applyOptionalAndContinuation(d, p!, true);
    for (let k = 0; k < 6; k++) {
      _drainAllEffectPicksForTest(d, pickOppForRemove);
      runAllUntilEmpty(d);
    }
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
  for (const d of [B09022, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// a1 (1) 緑 + 解決編 + する + 服部平次 slept → sleep+discard+sceneRemove(opp) + draw 1
// ============================================================
describe('B09022 a1 — する: 服部平次 slept → sleep/discard/sceneRemove/draw', () => {
  function board(): GameState {
    const s = base();
    s.players.self.scene = []; // enterWakaba が B09022 を追加
    s.players.self.hand = ['HAND1'];
    return s;
  }
  it('服部平次(探偵lv8) をスリープ + 手札1リムーブ + opp TGT 除去 (lv8 DECOY 除外) + draw 1', () => {
    setHuman('self');
    const s0 = board();
    // HATTORI を self 現場に置いた状態で B09022 を enter
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('HATTORI', 'hattori')); });
    const afterEnter = enterWakaba(seeded);
    // opp 現場 (sceneRemove 対象) を enter 後に配置 (enter 時点の trigger 条件には無関係)
    const withOpp = produce(afterEnter, (d) => { d.players.opp.scene = [sc('TGT', 'tgt'), sc('DECOY', 'decoy')]; });
    const after = takeAndDrain(withOpp);

    expect(after.players.self.scene.find((c) => c.uid === 'hattori')!.state, '服部平次 sleep').toBe('sleep');
    expect(after.players.self.remove.includes('HAND1'), 'HAND1 discard 済').toBe(true);
    expect(after.players.opp.scene.some((c) => c.uid === 'tgt'), 'opp TGT(lv5) 除去').toBe(false);
    expect(after.players.opp.scene.some((c) => c.uid === 'decoy'), 'opp DECOY(lv8) は levelMax7 で残存').toBe(true);
    expect(after.players.self.deck.length, 'draw 1 → deck -1').toBe(3);
    expect(after.players.self.hand.includes('DRAWN'), '引いた DRAWN が手札に').toBe(true);
    expect(after.players.self.hand.includes('HAND1'), 'HAND1 は手札に無い (discard 済)').toBe(false);
  });
});

// ============================================================
// a1 (2) する + 非named 探偵(lv≥6) slept → draw なし
// ============================================================
describe('B09022 a1 — する: 非named 探偵 slept → 「服部平次/江戸川コナン」gate で draw なし', () => {
  it('DETECTIVE(探偵lv6, 非named) sleep → discard/sceneRemove は起きるが draw しない', () => {
    setHuman('self');
    const s0 = base();
    s0.players.self.scene = [];
    s0.players.self.hand = ['HAND1'];
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('DETECTIVE', 'det')); });
    const afterEnter = enterWakaba(seeded);
    const withOpp = produce(afterEnter, (d) => { d.players.opp.scene = [sc('TGT', 'tgt')]; });
    const after = takeAndDrain(withOpp);

    expect(after.players.self.scene.find((c) => c.uid === 'det')!.state, 'DETECTIVE sleep').toBe('sleep');
    expect(after.players.self.remove.includes('HAND1'), 'discard は起きる').toBe(true);
    expect(after.players.opp.scene.some((c) => c.uid === 'tgt'), 'sceneRemove は起きる').toBe(false);
    expect(after.players.self.deck.length, '非named ゆえ draw しない (deck 不変)').toBe(4);
    expect(after.players.self.hand.includes('DRAWN'), 'DRAWN 引かない').toBe(false);
  });
});

// ============================================================
// a1 (3) パートナー非緑 → 発動しない
// ============================================================
describe('B09022 a1 — condition gate: partnerColor', () => {
  it('パートナー非緑(赤) → 【パートナー緑】不成立 → 発動しない', () => {
    setHuman('self');
    const s0 = base();
    s0.players.self.partner = { cardId: 'RPARTNER', state: 'active', location: 'partner-area' };
    s0.players.self.scene = [];
    s0.players.self.hand = ['HAND1'];
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('HATTORI', 'hattori')); });
    const afterEnter = enterWakaba(seeded);
    expect(_peekPendingEffectOptionalSide(), '非緑では surface しない').toBeNull();
    expect(afterEnter.players.self.scene.find((c) => c.uid === 'hattori')!.state, '服部平次 active のまま').toBe('active');
  });
});

// ============================================================
// a1 (4) 事件編 → 発動しない
// ============================================================
describe('B09022 a1 — condition gate: caseStatus', () => {
  it('事件編 → 【解決編】不成立 → 発動しない', () => {
    setHuman('self');
    const s0 = base();
    s0.players.self.case.status = '事件編';
    s0.players.self.scene = [];
    s0.players.self.hand = ['HAND1'];
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('HATTORI', 'hattori')); });
    const afterEnter = enterWakaba(seeded);
    expect(_peekPendingEffectOptionalSide(), '事件編では surface しない').toBeNull();
    expect(afterEnter.players.self.hand.length, '手札不変 (discard なし)').toBe(1);
  });
});

// ============================================================
// a1 (5) しない (decline) → 何も起きない
// ============================================================
describe('B09022 a1 — しない: 何も起きない', () => {
  it('optional=false → sleep/discard/sceneRemove/draw いずれも起きない', () => {
    setHuman('self');
    const s0 = base();
    s0.players.self.scene = [];
    s0.players.self.hand = ['HAND1'];
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('HATTORI', 'hattori')); });
    const afterEnter = enterWakaba(seeded);
    const withOpp = produce(afterEnter, (d) => { d.players.opp.scene = [sc('TGT', 'tgt')]; });
    const after = produce(withOpp, (d) => {
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, false);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.find((c) => c.uid === 'hattori')!.state, '服部平次 active').toBe('active');
    expect(after.players.self.hand, '手札不変').toEqual(['HAND1']);
    expect(after.players.opp.scene.some((c) => c.uid === 'tgt'), 'opp TGT 残存').toBe(true);
    expect(after.players.self.deck.length, 'draw なし').toBe(4);
  });
});

// ============================================================
// a1 (6) filter gate: レベル5 探偵 は sleep 候補外 (levelMin6)
// ============================================================
describe('B09022 a1 — sleep filter gate: 探偵 lv5 は選べない', () => {
  it('自現場に 探偵lv5 のみ → 「1枚スリープさせ」(n:1) の候補0 で chain 全停止 (discard/sceneRemove/draw いずれも起きない)', () => {
    setHuman('self');
    const s0 = base();
    s0.players.self.scene = [];
    s0.players.self.hand = ['HAND1'];
    const seeded = produce(s0, (d) => { d.players.self.scene.push(sc('DET5', 'det5')); });
    const afterEnter = enterWakaba(seeded);
    const withOpp = produce(afterEnter, (d) => { d.players.opp.scene = [sc('TGT', 'tgt')]; });
    // 観測 (probe 実測): sleep が必須 n:1 (「〜まで」ではない) のため 候補0 で continuation が halt。
    // → discard も sceneRemove も draw も起きない。lv5 探偵が候補なら slept される筈 = filter gate 証明。
    const after = takeAndDrain(withOpp);

    const det5 = after.players.self.scene.find((c) => c.uid === 'det5');
    expect(det5, 'DET5 は現場に残る').toBeTruthy();
    expect(det5!.state, 'DET5(探偵lv5) は slept されない (levelMin6 で候補外)').toBe('active');
    expect(after.players.self.remove.includes('HAND1'), 'chain halt → discard 起きない').toBe(false);
    expect(after.players.self.hand, '手札不変').toEqual(['HAND1']);
    expect(after.players.opp.scene.some((c) => c.uid === 'tgt'), 'chain halt → sceneRemove 起きない (TGT 残存)').toBe(true);
    expect(after.players.self.deck.length, 'draw なし (deck 不変)').toBe(4);
  });
});

// ============================================================
// a2 removedCharMatches{side:opp, cause:contact-ap, by:self} → draw 1
// ============================================================
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function a2Board(): GameState {
  const s = base();
  s.players.self.scene = [sc('B09022', 'wakaba'), sc('OTHER', 'other')];
  s.players.opp.scene = [sc('VIC', 'vic')];
  return s;
}

describe('B09022 a2 — コンタクト除去 observer (draw 1)', () => {
  it('(7) 相手キャラが B09022 とのコンタクト(contact-ap)で除去 → queue + draw 1', () => {
    // observerFired (queue) を先に確認
    const queued = produce(a2Board(), (d) => {
      mutateAll.scene.removeToRemove(d, 'vic', 'contact-ap', 'wakaba');
    });
    expect(observerFired(queued, 'wakaba'), 'by:self コンタクト除去で発火 queue').toBe(true);
    // 続けて resolve → draw 1 (deck -1)
    const resolved = produce(a2Board(), (d) => {
      mutateAll.scene.removeToRemove(d, 'vic', 'contact-ap', 'wakaba');
      runAllUntilEmpty(d);
    });
    expect(resolved.players.self.deck.length, 'draw 1 → deck -1').toBe(3);
    expect(resolved.players.self.hand.includes('DRAWN'), '引いた DRAWN が手札に').toBe(true);
  });

  it('(8) cause=effect (非contact) で除去 → 発火しない (cause filter pin)', () => {
    const after = produce(a2Board(), (d) => {
      mutateAll.scene.removeToRemove(d, 'vic', 'effect', 'wakaba');
      runAllUntilEmpty(d);
    });
    expect(observerFired(after, 'wakaba'), 'cause=effect は非発火').toBe(false);
    expect(after.players.self.deck.length, 'draw なし (deck 不変)').toBe(4);
  });

  it('(9) 自分のキャラがコンタクトで除去 → 発火しない (side:opp pin)', () => {
    // OTHER(自分キャラ) を victim にして wakaba を byUid にする
    const after = produce(a2Board(), (d) => {
      mutateAll.scene.removeToRemove(d, 'other', 'contact-ap', 'wakaba');
      runAllUntilEmpty(d);
    });
    expect(observerFired(after, 'wakaba'), '自キャラ除去 (side=self) は非発火').toBe(false);
    expect(after.players.self.deck.length, 'draw なし').toBe(4);
  });

  it('(9b) B09022 が関与しないコンタクト除去 → 発火しない (by:self pin)', () => {
    // 相手キャラを別の自キャラ(other)が除去 → byUid ≠ source.uid
    const after = produce(a2Board(), (d) => {
      mutateAll.scene.removeToRemove(d, 'vic', 'contact-ap', 'other');
      runAllUntilEmpty(d);
    });
    expect(observerFired(after, 'wakaba'), 'byUid≠自身 は非発火').toBe(false);
    expect(after.players.self.deck.length, 'draw なし').toBe(4);
  });
});
