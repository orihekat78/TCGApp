// hybrid-batch2 probe — B09089「刑事だらけの店」(event, level 7, 黄, engine変更0)
//
// 公式テキスト:
//   AP8000以下のキャラを1枚まで選び、リムーブする。このターン中、自分の現場にキャラが登場していない
//   場合、自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
//
// DSL: triggered(effect:declared, selfOnly, matcher kind==='event-use') →
//   sequence[
//     atom sceneRemove{player:'self', max:1, side:'either', filter:{apMax:8000}},        // AP8000以下を1枚まで remove
//     conditional{ if enterCountAtMost{player:'self', n:0}                               // このターン自分の現場に未登場
//       then atom sceneEnter{player:'self', from:'remove', max:1, viaEffect:true,
//                            filter:{trait:'警察', levelMax:4, kind:'character'}} } ]     // remove から警察Lv4以下を1枚まで登場
//
// enterCountAtMost は turnState[self].enterCountThisTurn を直読 (cond/eval.ts:343)。
//   このカウンタは mutate/scene.ts enter() のみが increment、turn:start で 0 リセット。
//   → production enter path (scene.enter) で登場させると +1、直置き (scene 配列に push) では +0。
//   本テストは case2 で scene.enter を real mechanism として使い「登場した」旗を立てる。
//
// 検証面 (全句を production dispatch = handUseCard 経由で実測):
//   1. 未登場 → sceneRemove が apMax:8000 を honor (AP9000 decoy 除外 / 相手キャラ removable) →
//      revive pick が remove から trait 警察 + levelMax 4 + kind character を honor
//      (Lv5警察 / Lv3非警察 / event を除外) → picked char が現場に登場。
//   2. 同ターンに自陣へ 1体登場済 (scene.enter 経由) → conditional 不成立 → revive pick surface せず
//      (ただし sceneRemove 句は解決される)。
//   3.「1枚まで」両句: sceneRemove を human 辞退 (sequence-origin) でも revive 句へ進む /
//      revive も 0枚辞退 = 合法。
//   4. イベントカードは解決後リムーブエリアへ / 手札 -1。
//
// 人手 pick は setHuman('self') で held → _drainPendingEffectPickSide + apply/skip で駆動 (B05103 慣行)。

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene as mutateScene, _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B09089 } from '@/cards/ct-p09/B09089';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('HAND_X'),                                             // 手札 -1 の観測用 (event 以外の1枚)
  def('SELF9000', { ap: 9000 }),                            // 自陣 decoy: apMax:8000 で sceneRemove 候補外
  def('OPP5000', { ap: 5000 }),                             // 相手陣: AP5000 → sceneRemove 候補
  def('REVIVE', { level: 3, traits: ['警察'] }),            // revive 正候補 (Lv3 警察 character)
  def('LV5POL', { level: 5, traits: ['警察'] }),            // decoy: levelMax:4 で除外
  def('LV3CIV', { level: 3, traits: [] }),                  // decoy: trait:警察 で除外
  def('EVREM', { kind: 'event', level: 3, traits: ['警察'] }), // decoy: kind:character で除外
  def('YPART', { colors: ['黄'] }),                         // 黄 パートナー
];

type Opt = { partner?: string; remove?: string[]; selfScene?: SceneCharacter[]; oppScene?: SceneCharacter[] };

function base(o: Opt = {}): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2', 'DK3', 'DK4'];
  s.players.opp.deck = ['ODK1', 'ODK2'];
  s.players.self.hand = ['B09089', 'HAND_X'];
  s.players.self.partner.cardId = o.partner ?? 'YPART';
  s.players.self.case.colors = ['黄'];                       // event 色 黄 → 色制限クリア
  s.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: 'FILL' }));
  s.players.self.remove = o.remove ?? ['REVIVE', 'LV5POL', 'LV3CIV', 'EVREM'];
  if (o.selfScene) s.players.self.scene = o.selfScene;
  if (o.oppScene) s.players.opp.scene = o.oppScene;
  return s;
}

const drain = () => _drainPendingEffectPickSide();

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of [B09089, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B09089 — 未登場: remove pick (apMax honor) → revive pick (trait/level/kind honor)', () => {
  it('AP8000以下を1枚remove → 警察Lv4以下をリムーブから登場', () => {
    const s = base({ selfScene: [sc('SELF9000', 'sc1')], oppScene: [sc('OPP5000', 'oc1')] });

    handUseCard(s, 'self', 'B09089');
    runAllUntilEmpty(s);

    // ---- item 4: イベント使用で手札 -1 / リムーブエリアへ ----
    expect(s.players.self.hand, 'B09089 は手札を離れる (event 使用)').toEqual(['HAND_X']);
    expect(s.players.self.remove, 'B09089 はリムーブエリアへ (rules/06)').toContain('B09089');

    // ---- step1: sceneRemove (side:either, apMax:8000) ----
    const p1 = drain();
    expect(p1?.atomVerb, 'sceneRemove pick が surface').toBe('sceneRemove');
    const p1uids = (p1!.candidates as Array<{ uid: string }>).map(c => c.uid).sort();
    expect(p1uids, 'AP9000 の SELF9000(sc1) は apMax:8000 で除外、相手 oc1 のみ候補').toEqual(['oc1']);
    applyPickAndContinuation(s, p1!, 'oc1');
    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), '相手キャラ oc1 removed').toBe(false);
    expect(s.players.self.scene.some(c => c.uid === 'sc1'), '自陣 SELF9000 は残存').toBe(true);

    // ---- step2: sceneEnter (from remove, trait 警察 + levelMax 4 + kind character) ----
    const p2 = drain();
    expect(p2?.atomVerb, 'enterCountAtMost n:0 成立 → revive pick').toBe('sceneEnter');
    const p2cands = p2!.candidates as Array<{ uid: string; cardId: string }>;
    expect(p2cands.map(c => c.cardId).sort(), 'REVIVE のみ (Lv5警察/Lv3非警察/event を除外)').toEqual(['REVIVE']);
    const revive = p2cands.find(c => c.cardId === 'REVIVE')!;
    applyPickAndContinuation(s, p2!, revive.uid);

    // ---- 結果 ----
    expect(s.players.self.scene.some(c => c.cardId === 'REVIVE'), 'REVIVE が現場に登場').toBe(true);
    expect(s.players.self.remove.includes('REVIVE'), 'REVIVE はリムーブエリアから抜ける').toBe(false);
    expect(s.players.self.remove.sort(), '残 remove は decoy 3枚 + 使用済 B09089').toEqual(['B09089', 'EVREM', 'LV3CIV', 'LV5POL']);
    expect(drain(), '以降 pick は無い').toBeNull();
  });
});

describe('B09089 — このターン登場済 (production enter path) → conditional 不成立', () => {
  it('scene.enter で 1体登場 → sceneRemove は解決するが revive pick は出ない', () => {
    const s = base({ oppScene: [sc('OPP5000', 'oc1')] });
    // real mechanism: enter() が turnState.self.enterCountThisTurn を +1 する
    mutateScene.enter(s, 'self', 'SELF9000', {});
    expect(s.turnState.self.enterCountThisTurn, '登場旗 = 1').toBe(1);

    handUseCard(s, 'self', 'B09089');
    runAllUntilEmpty(s);

    const p1 = drain();
    expect(p1?.atomVerb, 'sceneRemove 句は解決される').toBe('sceneRemove');
    const p1uids = (p1!.candidates as Array<{ uid: string }>).map(c => c.uid).sort();
    expect(p1uids, '登場した SELF9000(AP9000) は apMax 除外 → 相手 oc1 のみ').toEqual(['oc1']);
    applyPickAndContinuation(s, p1!, 'oc1');
    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), '相手キャラ removed').toBe(false);

    expect(drain(), 'enterCountAtMost 不成立 (1 > 0) → revive pick は surface しない').toBeNull();
    expect(s.players.self.remove.includes('REVIVE'), 'REVIVE は remove に残存 (登場せず)').toBe(true);
  });
});

describe('B09089 —「1枚まで」両句の 0枚辞退', () => {
  it('sceneRemove を human 辞退 (sequence-origin) → revive 句へ進む / revive も辞退可', () => {
    const s = base({ selfScene: [sc('SELF9000', 'sc1')], oppScene: [sc('OPP5000', 'oc1')] });

    handUseCard(s, 'self', 'B09089');
    runAllUntilEmpty(s);

    // step1: sceneRemove を 0枚辞退 (sequence-origin decline)
    const p1 = drain();
    expect(p1?.atomVerb).toBe('sceneRemove');
    applyPickSkipAndContinuation(s, p1!, false);
    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), 'キャラは remove されていない').toBe(true);
    expect(s.players.self.scene.some(c => c.uid === 'sc1'), '自陣も不変').toBe(true);

    // step2: 未登場 (辞退は enter しない) ゆえ revive 句へ進む
    const p2 = drain();
    expect(p2?.atomVerb, 'sceneRemove 辞退でも conditional 解決 → revive surface').toBe('sceneEnter');
    applyPickSkipAndContinuation(s, p2!, false); // revive も 0枚辞退

    expect(drain(), 'revive 辞退で終了').toBeNull();
    expect(s.players.self.remove.includes('REVIVE'), 'REVIVE 未登場 → remove に残る').toBe(true);
    expect(s.players.self.scene.length, '現場は SELF9000 のみ (登場なし)').toBe(1);
  });
});
