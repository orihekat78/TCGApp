// gate5 RUNTIME behavior — B07004 吉田歩美 (character, 青/少年探偵団, L7 AP5000 LP1)
//
// 公式テキスト:
//   【パートナー青】【宣言】【スリープ】：自分のデッキのカードを上から4枚見る。その中からレベル8以下の
//     〚カード名［小嶋元太］〛か〚［円谷光彦］〛のキャラを1枚まで登場させ、残りを好きな順番でデッキの下に移す。
//     キャラを登場させた場合、手札を1枚リムーブする。
//
// rules: 21-declared-ability-cost.md (【宣言】【スリープ】コスト=自身スリープ / コストはすべて行う) /
//        17-icons.md (【パートナー青】条件アイコン: 条件未達=能力を持たない扱い / 「〜まで」=0枚可) /
//        15-abilities-effects.md (「〜まで」=0枚可 / 「〜する」=必須 / 解決時の状態参照) /
//        20-color-and-switch.md (効果による登場=色制限なし) /
//        26-qa-deck-refresh.md (deck-look 中はデッキ扱い / 「1枚まで…登場」加えない選択可).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   activateDeclaredAbility('sonoko#... ',(uid),'a1') → cost sleepSelf pay (B07004 自身 sleep) +
//   effect:declared queue → runAllUntilEmpty + drainAiEffectPicks (AI 経路: 先頭 match 自動取得)。
//
// 検証する filter / 条件 (BUG-117/118 lesson: DSL に書いても engine が実評価する保証はない):
//   (COND) 【パートナー青】 = ability.condition {kind:'partnerColor', color:'青'} を canDeclaredAbility が
//          **実評価** しているか。partner=青 → 宣言可 / partner=赤 (非青) → 宣言不可 (能力を持たない扱い)。
//   (A) deckRevealUntil filter {cardName:['小嶋元太','円谷光彦'], levelMax:8, kind:'character'} を engine が
//       **実評価** しているか。上4枚中:
//         - 名前違いのキャラ (DEC_..._WRONGNAME) → match しない (cardName filter)。
//         - 小嶋元太 だが kind:event (DEC_..._EVENTKIND) → match しない (kind filter)。
//         - 小嶋元太 だが level9 (DEC_..._LV9) → match しない (levelMax8 filter)。
//         - 小嶋元太 level8 (DEC_..._HIT) → match → 登場する。
//   (B) 「登場させた場合、手札を1枚リムーブする」= conditional{if:$matched matched} → discard n:1。
//       match があったとき **のみ** 手札1リムーブ / match 無しなら手札不変 (conditional 不発)。
//
// decoy / negative:
//   COND-N: partner=赤 → canDeclaredAbility=false (partnerColor 条件未達)。
//   A-DECOY: 上4枚先頭に名前違いキャラ decoy を置く。filter 無視なら「最初の character」= decoy が拾われる
//            (BUG-117/118 型バグ)。filter honor なら decoy を skip し 小嶋元太 (HIT) を拾う。
//   N1 (match 無し): 上4枚全て非該当 (名前違い / event種別 / level9) → 0体登場 + 全4枚デッキ下 +
//            手札リムーブ無し (conditional 不発 = 「登場させた場合」未成立)。
//   N2 (0-pick, human decline): 上4枚に 小嶋元太(HIT) があっても human が decline → 0体登場 +
//            全4枚デッキ下 + 手札リムーブ無し (「1枚まで」=0枚可、rules/15)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import {
  drainAiEffectPicks,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B07004 } from '@/cards/ct-p07/B07004';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic defs (prefix DEC_B07004_ で id 衝突回避) ----
// deck-reveal の唯一の有効 match: 小嶋元太 / level8 / kind:character。
const HIT = 'DEC_B07004_HIT';
// decoy 1: kind:character だが名前違い (江戸川コナン) → cardName filter で弾かれる。
const WRONGNAME = 'DEC_B07004_WRONGNAME';
// decoy 2: 名前=小嶋元太 だが kind:event → kind:'character' filter で弾かれる。
const EVENTKIND = 'DEC_B07004_EVENTKIND';
// decoy 3: 名前=小嶋元太 / character だが level9 (> levelMax8) → levelMax filter で弾かれる。
const LV9 = 'DEC_B07004_LV9';
// 第2の有効 match 候補 (円谷光彦) — array-OR の対側を証明。
const MITSU = 'DEC_B07004_MITSU';
// 手札 discard 対象 (「登場させた場合、手札を1枚リムーブ」)。
const HANDCARD = 'DEC_B07004_HANDCARD';
// deck filler (top4 外 + refresh 回避)。
const FILLER = 'DEC_B07004_FILLER';
// 青 partner (【パートナー青】成立) / 赤 partner (条件未達 decoy)。
const PARTNER_BLUE = 'DEC_B07004_PARTNER_BLUE';
const PARTNER_RED = 'DEC_B07004_PARTNER_RED';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 4, ap: 4000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'],
    level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function partner(id: string, color: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color],
    level: 0, ap: 0, lp: 7, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function registerDecoys(): void {
  // HIT: 小嶋元太 / level8 / character → 唯一 match (levelMax8 境界も検証)。
  registerCardDef(ch(HIT, { names: ['小嶋元太'], level: 8 }));
  // WRONGNAME: 江戸川コナン / level4 / character → cardName decoy。
  registerCardDef(ch(WRONGNAME, { names: ['江戸川コナン'], level: 4 }));
  // EVENTKIND: 小嶋元太 だが event → kind decoy。
  registerCardDef(ev(EVENTKIND, { names: ['小嶋元太'] }));
  // LV9: 小嶋元太 / level9 / character → levelMax decoy。
  registerCardDef(ch(LV9, { names: ['小嶋元太'], level: 9 }));
  // MITSU: 円谷光彦 / level6 / character → array-OR の対側 match。
  registerCardDef(ch(MITSU, { names: ['円谷光彦'], level: 6 }));
  registerCardDef(ch(HANDCARD, { names: ['歩美の手札'], level: 1 }));
  registerCardDef(ch(FILLER, { names: ['filler'], level: 1 }));
  registerCardDef(partner(PARTNER_BLUE, '青'));
  registerCardDef(partner(PARTNER_RED, '赤'));
}

// 宣言能力 a1 発火 base: B07004 を自現場に active で host。partner=青 で条件成立。
function declBase(partnerId: string = PARTNER_BLUE): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B07004', 'ayumi#1', { state: 'active' })];
  s.players.self.partner.cardId = partnerId;
  s.players.self.case.colors = ['青'];
  return s;
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const sceneState = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid)?.state;

describe('B07004 吉田歩美 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    setHuman(null); // AI 経路 (先頭 match 自動取得)
  });

  // ============================================================
  // COND: 【パートナー青】= ability.condition {partnerColor:'青'} 実評価
  // ============================================================
  it('COND + DECOY: partner=青 → a1 宣言可 / partner=赤 (非青) → 宣言不可 (条件アイコン実評価)', () => {
    const blue = declBase(PARTNER_BLUE);
    expect(canDeclaredAbility(blue, 'ayumi#1', 'a1'), 'partner=青 → 宣言可').toBe(true);
    // DECOY: partner=赤 → partnerColor:'青' 未達 → rules/17 能力を持たない扱い → 宣言不可
    const red = declBase(PARTNER_RED);
    expect(canDeclaredAbility(red, 'ayumi#1', 'a1'), 'partner=赤 → partnerColor青 未達で宣言不可').toBe(false);
  });

  // ============================================================
  // a1 positive + DECOY: 上4枚から 小嶋元太(HIT) を登場 / 非該当3 decoy は skip & デッキ下 + 手札1リムーブ
  // ============================================================
  it('a1 + DECOY: 上4枚中 小嶋元太(HIT/L8) を登場、名前違い/event/L9 decoy は skip→デッキ下 + 手札1リムーブ + 自身sleep', () => {
    let s = declBase();
    // deck top4: [名前違いキャラ(先頭), event種別(小嶋元太), level9(小嶋元太), HIT(小嶋元太 L8)] + filler×2。
    //   filter 無視なら「最初の character」= 先頭の WRONGNAME が拾われる (BUG-117/118 型バグ)。
    //   filter honor なら WRONGNAME/EVENTKIND/LV9 を skip し HIT を拾う。
    s.players.self.deck = [WRONGNAME, EVENTKIND, LV9, HIT, FILLER, FILLER];
    s.players.self.hand = [HANDCARD]; // discard 対象 (「登場させた場合、手札を1枚リムーブ」)

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'ayumi#1', 'a1'); // cost sleepSelf pay + effect:declared queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: 先頭 match=HIT を自動取得 + discard pick 解決
    });

    // cost: 【スリープ】で自身がスリープ (rules/21)
    expect(sceneState(s, 'ayumi#1'), 'cost【スリープ】: B07004 自身が sleep').toBe('sleep');

    // (A) deckRevealUntil filter: 該当 HIT のみ登場、デッキから抜ける
    expect(inScene(s, HIT), '小嶋元太(L8 HIT) が登場').toBe(true);
    expect(inDeck(s, HIT), 'HIT はデッキから抜けた').toBe(false);
    // DECOY 主張: 非該当 3 decoy は登場せず、残りとしてデッキ下へ
    expect(inScene(s, WRONGNAME), 'DECOY: 名前違いキャラは登場しない (cardName filter)').toBe(false);
    expect(inScene(s, EVENTKIND), 'DECOY: event種別(小嶋元太)は登場しない (kind filter)').toBe(false);
    expect(inScene(s, LV9), 'DECOY: level9(小嶋元太)は登場しない (levelMax8 filter)').toBe(false);
    // 非該当 3 decoy は「残り」としてデッキに残る (下へ)
    expect(inDeck(s, WRONGNAME), 'WRONGNAME は残りとしてデッキへ').toBe(true);
    expect(inDeck(s, EVENTKIND), 'EVENTKIND は残りとしてデッキへ').toBe(true);
    expect(inDeck(s, LV9), 'LV9 は残りとしてデッキへ').toBe(true);
    // top4 外の filler はデッキに残る (look されていない)
    expect(inDeck(s, FILLER), 'top4外 filler はデッキに残る').toBe(true);
    // 現場に新規登場したのはちょうど1体 (B07004 自身 + HIT = 2 体、HIT のみ新規)
    expect(s.players.self.scene.length, '現場 = B07004 + 登場した HIT の 2 体').toBe(2);

    // (B) 「登場させた場合、手札を1枚リムーブ」: 登場したので手札1リムーブ
    expect(inHand(s, HANDCARD), '手札カードはリムーブされ手札から消えた').toBe(false);
    expect(inRemove(s, HANDCARD), '手札カードはリムーブエリアへ').toBe(true);
    expect(s.players.self.hand.length, '手札 -1 (登場 → 1リムーブ)').toBe(0);
  });

  // ============================================================
  // a1 array-OR: 円谷光彦(MITSU) も match する (cardName 配列の対側)
  // ============================================================
  it('a1 array-OR: 上4枚に 円谷光彦(MITSU) のみ該当 → MITSU を登場 (cardName 配列 OR の対側)', () => {
    let s = declBase();
    // 該当は MITSU(円谷光彦) のみ。先頭 decoy WRONGNAME は cardName filter で skip。
    s.players.self.deck = [WRONGNAME, MITSU, FILLER, FILLER, FILLER];
    s.players.self.hand = [HANDCARD];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'ayumi#1', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(inScene(s, MITSU), '円谷光彦(MITSU) が登場 (array-OR の対側)').toBe(true);
    expect(inScene(s, WRONGNAME), 'DECOY: 名前違いは登場しない').toBe(false);
    expect(inDeck(s, MITSU), 'MITSU はデッキから抜けた').toBe(false);
    expect(inRemove(s, HANDCARD), '登場したので手札1リムーブ').toBe(true);
  });

  // ============================================================
  // a1 NEGATIVE (match 無し): 「登場させた場合」未成立 → 手札リムーブ無し (conditional 不発)
  // ============================================================
  it('a1 NEGATIVE (match 無し): 上4枚全て非該当 → 0体登場 + 全4枚デッキ下 + 手札リムーブ無し (conditional 不発)', () => {
    let s = declBase();
    // 上4枚: 名前違いキャラ / event(小嶋元太) / level9(小嶋元太) / 名前違いキャラ → 該当 0。
    s.players.self.deck = [WRONGNAME, EVENTKIND, LV9, WRONGNAME, FILLER, FILLER];
    s.players.self.hand = [HANDCARD];
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'ayumi#1', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // cost は支払済み (rules/21: cost-first)
    expect(sceneState(s, 'ayumi#1'), 'cost【スリープ】は支払済み (自身 sleep)').toBe('sleep');
    // 登場 0 (該当キャラ無し)
    expect(s.players.self.scene.length, '現場 = B07004 のみ (新規登場 0)').toBe(1);
    expect(inScene(s, EVENTKIND), 'event decoy は登場しない').toBe(false);
    expect(inScene(s, LV9), 'level9 decoy は登場しない').toBe(false);
    // 上4枚は全て「残り」としてデッキに残る
    expect(inDeck(s, EVENTKIND), 'EVENTKIND はデッキに残る (下へ)').toBe(true);
    expect(inDeck(s, LV9), 'LV9 はデッキに残る (下へ)').toBe(true);
    expect(s.players.self.deck.filter((c) => c === WRONGNAME).length, 'WRONGNAME×2 はデッキに残る').toBe(2);
    // (B) 「登場させた場合」未成立 → 手札リムーブ無し
    expect(s.players.self.hand.length, 'NEGATIVE: 登場 0 → 手札不変 (conditional 不発)').toBe(handBefore);
    expect(inHand(s, HANDCARD), '手札カードはリムーブされず残る').toBe(true);
    expect(inRemove(s, HANDCARD), '手札カードはリムーブエリアに移らない').toBe(false);
  });

  // ============================================================
  // a1 NEGATIVE (0-pick, human decline): 「1枚まで」=0枚可 — HIT があっても登場せず手札リムーブ無し
  // ============================================================
  it('a1 NEGATIVE (0-pick): human decline — 小嶋元太(HIT)があっても 0体登場 + 全デッキ下 + 手札リムーブ無し (「1枚まで」=0枚可)', () => {
    setHuman('self'); // human owner → chooseMatch:'upTo' pick を surface (decline channel)
    let s = declBase();
    s.players.self.deck = [HIT, FILLER, FILLER, FILLER];
    s.players.self.hand = [HANDCARD];
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'ayumi#1', 'a1');
      runAllUntilEmpty(d); // human 経路: deckRevealUntil pick を surface して pause
    });

    // pick が surface していること + 候補 = HIT のみ + 「〜まで」=0枚可
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'deckRevealUntil pick が surface (= a1 発火)').toBe('deckRevealUntil');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    expect(pending!.candidates.map((c) => c.cardId), '候補は 小嶋元太(HIT) のみ (cardName filter)').toEqual([HIT]);
    // decline 前は登場していない
    expect(inScene(s, HIT), 'decline 前は登場していない').toBe(false);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // 0体登場 (「1枚まで」=0枚可)
    expect(inScene(s, HIT), 'decline: HIT は登場しない').toBe(false);
    expect(s.players.self.scene.length, '現場 = B07004 のみ').toBe(1);
    // 全 reveal がデッキ下 (HIT も「残り」扱い)
    expect(inDeck(s, HIT), 'decline: HIT は残りとしてデッキへ').toBe(true);
    // 「登場させた場合」未成立 → 手札リムーブ無し
    expect(s.players.self.hand.length, 'decline: 登場 0 → 手札不変 (conditional 不発)').toBe(handBefore);
    expect(inRemove(s, HANDCARD), 'decline: 手札カードはリムーブされない').toBe(false);
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1=declared/sleepSelf/partnerColor青, deckRevealUntil{maxN4,upTo,cardName配列OR,levelMax8,character} → conditional($matched)→sceneEnter(deck) → deckToBottomBound → conditional($matched)→discard1', () => {
    const a1 = B07004.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.scope).toBe('on-scene');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '青' });
    expect(a1.cost).toMatchObject({ kind: 'sleepSelf' });

    const steps = (a1.effect as { kind: string; steps: Array<Record<string, unknown>> }).steps;
    // step0: deckRevealUntil
    expect(steps[0]).toMatchObject({
      kind: 'atom', verb: 'deckRevealUntil',
      args: {
        maxN: 4, chooseMatch: 'upTo',
        filter: { cardName: ['小嶋元太', '円谷光彦'], levelMax: 8, kind: 'character' },
        bind: '$revealed', bindMatch: '$matched',
      },
    });
    // step1: conditional($matched matched) → sceneEnter from deck
    expect(steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'sceneEnter', args: { cardId: '$matched.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
    });
    // step2: deckToBottomBound($revealed)
    expect(steps[2]).toMatchObject({ kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } });
    // step3: conditional($matched matched) → discard 1
    expect(steps[3]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    });
  });
});
