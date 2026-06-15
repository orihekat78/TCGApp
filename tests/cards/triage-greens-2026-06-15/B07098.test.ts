// gate5 RUNTIME behavior — B07098 キャンティ (character, 黒/黒ずくめの組織, L3 AP2000 LP1)
//
// 公式テキスト:
//   a1: 【事件編】【登場時】自分のデッキのカードを上から2枚リムーブする。
//       自分のリムーブエリアに【カットイン】を持つカードがある場合、カードを1枚引く。
//   a2: 【解決編】【宣言】【ターン1】〚手札から【カットイン】を持つ【黒】のカードを1枚リムーブする〛：
//       自分のリムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき、
//       ターン終了時までこのキャラをAP＋1000する。
//   a3: 【カットイン】AP＋1000
//
// rules: 09-cutin-disguise.md (カットイン: コンタクト中手札からリムーブ / 色制限なし) /
//        14-refresh.md (デッキ0で refresh) / 15-abilities-effects.md (「〜の場合」条件 / 解決時状態参照) /
//        17-icons.md (【事件編】/【解決編】/【ターン1】条件アイコン / 「〜を持つ」=印字判定 BUG-122) /
//        19-special-rules.md (AP下限なし) / 21-declared-ability-cost.md (【宣言】コストはすべて行う) /
//        22-qa-action-contact.md (カットインによる AP+ は発生時点判定).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/条件 を書いても engine が実評価する保証はない):
//   a1: conditional.if = sceneHas{area:'remove', side:'self', filter:{keyword:'カットイン'}, nMin:1}。
//       → リムーブエリアに【カットイン】持ちカードが「ある場合のみ」draw。無ければ draw しない。
//       defHasKeyword('カットイン') = abilityIsCutin (read/keyword.ts) で印字判定。
//   a2: (i) condition caseStatus '解決編' を canDeclaredAbility が gate (BUG-099)。事件編では宣言不可。
//       (ii) cost removeFromHand filter {keyword:'カットイン', color:'黒'} を candidates() が honor。
//       (iii) effect forEach over:all {area:'remove', side:'self', filter:{keyword:'カットイン', color:'黒'}}
//             → charModifyAP $self +1000 を 1 match につき 1 回。リムーブの【カットイン】持ち【黒】の
//             枚数 N に対し AP+1000×N (mutate/char.modifyAP ACCUMULATES)。
//       (iv) 【ターン1】(limit turn:1) を declaredUseCount が enforce。
//   a3: 【カットイン】= abilityIsCutin 形状 → defHasKeyword で「カットイン持ち」と認識され、実 contact で
//       cutIn() が攻撃キャラ ($contact.byUid) を AP+1000 する。
//
// decoy / negative (filter/条件が実評価されている証明):
//   a1-POS: リムーブに【カットイン】持ち (DEC_…CUTIN) → mill2 + draw1。
//   a1-DECOY/N: リムーブに【カットイン】を持たないカード (DEC_…PLAIN) のみ + mill するのも非カットイン
//       → 「カットイン持ちが無い」ので draw しない (keyword filter 実評価)。mill2 は実行される。
//   a2-DECOY: リムーブに 黒カットイン×2 (counted) + 緑カットイン (color filter で除外) +
//       黒の非カットイン (keyword filter で除外) → AP+1000×(黒カットイン枚数のみ)。
//   a2-N-condition: 事件編 (解決編でない) → canDeclaredAbility=false (caseStatus gate)。
//   a2-N-turnlimit: 1回宣言後は declaredUseCount で再宣言不可 (【ターン1】rules/24)。
//   a2-cost-DECOY: cost.canPay は 黒カットイン手札のみ true。緑カットイン / 黒非カットイン / 0枚 は false。
//   a3-DECOY: 非カットイン手札は canCutIn=false。カットイン手札は canCutIn=true → 実 cut で AP+1000。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import { canCutIn, cutIn } from '@/engine/flow/contact';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B07098 } from '@/cards/ct-p07/B07098';
import type { AbilityDef, CardDef, GameState, EffectCtx, ActionContext } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);

// ---- 【カットイン】持ち判定 (read/keyword.abilityIsCutin) を満たす ability 形状 ----
//   type:'triggered' + scope:'on-hand' + trigger{hook:'effect:declared', optional:true}
function cutinAbility(): AbilityDef {
  return {
    id: 'cutin',
    type: 'triggered',
    scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
    description: '【カットイン】AP＋1000',
    ruleRefs: [],
  };
}

// 合成 decoy 定義 (prefix DEC_B07098_ で id 衝突回避)。
function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黒'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// --- a1 conditional 用 ---
const CUTIN_BLK = 'DEC_B07098_CUTIN_BLK';   // 黒 + カットイン持ち (a1/a2 両 filter に該当)
const PLAIN_BLK = 'DEC_B07098_PLAIN_BLK';   // 黒 だが カットインを持たない (a1/a2 keyword filter で除外)
const CUTIN_GRN = 'DEC_B07098_CUTIN_GRN';   // 緑 + カットイン持ち (a2 color filter で除外 / a1 keyword は満たす)
const MILL_FIL = 'DEC_B07098_MILL_FIL';     // mill/draw 用 filler (非カットイン 黒)。

function registerDecoys(): void {
  registerCardDef(mkChar(CUTIN_BLK, { colors: ['黒'], abilities: [cutinAbility()] }));
  registerCardDef(mkChar(PLAIN_BLK, { colors: ['黒'], abilities: [] }));
  registerCardDef(mkChar(CUTIN_GRN, { colors: ['緑'], abilities: [cutinAbility()] }));
  registerCardDef(mkChar(MILL_FIL, { colors: ['黒'], abilities: [] }));
}

// 【事件編】【登場時】(a1) 発火用 base: B07098 を手札から登場 (黒/L3 → 事件黒 + FILE3 で色/レベルゲート)。
function enterBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B07098'];
  s.players.self.case.colors = ['黒'];
  s.players.self.case.status = '事件編'; // 既定だが明示
  s.players.self.file = [FB, FB, FB]; // FILE3 ≥ level3 (rules/12)
  return s;
}

const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const removeCount = (s: GameState, id: string) => s.players.self.remove.filter((c) => c === id).length;

describe('B07098 キャンティ — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    setHuman(null); // AI 経路 (自動解決)
  });

  // ============================================================
  // a1: 【事件編】【登場時】 mill2 + (remove に カットイン持ちが「ある場合」) draw1
  // ============================================================
  it('a1 POSITIVE: 登場で デッキ上2枚リムーブ + remove に カットイン持ち → 1ドロー', () => {
    let s = enterBase();
    // remove に カットイン持ち黒キャラを 1 枚 seed → conditional 成立。
    s.players.self.remove = [CUTIN_BLK];
    // deck: 上2枚 (mill 対象 = 非カットイン) + 3枚目 (draw 対象) + filler (refresh 回避)。
    s.players.self.deck = [MILL_FIL, MILL_FIL, PLAIN_BLK, MILL_FIL, MILL_FIL];
    const deckBefore = s.players.self.deck.length;

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07098');
      runAllUntilEmpty(d);
    });

    expect(inScene(s, 'B07098'), 'B07098 が登場').toBe(true);
    // mill2: 上2枚 (MILL_FIL ×2) が remove へ
    expect(removeCount(s, MILL_FIL), 'mill で上2枚 (MILL_FIL) が remove へ').toBe(2);
    // 3枚目 (PLAIN_BLK) を draw → 手札へ
    expect(inHand(s, PLAIN_BLK), 'remove に カットイン持ち有 → 3枚目を draw → 手札へ').toBe(true);
    // deck は 2(mill) + 1(draw) = 3 減
    expect(s.players.self.deck.length, 'deck は mill2 + draw1 = -3').toBe(deckBefore - 3);
    // seed の カットイン持ちは remove に残る
    expect(inRemove(s, CUTIN_BLK), 'seed の カットイン持ちは remove に残存').toBe(true);
  });

  it('a1 DECOY/NEGATIVE: remove に カットインを持たないカードのみ → mill2 はするが draw しない (keyword filter 実評価)', () => {
    let s = enterBase();
    // remove に 非カットイン (PLAIN_BLK) のみ → conditional 不成立。
    //   filter が無視されるなら「remove に何かカードがある」=draw してしまう (BUG-117/118 型)。
    //   filter が honor されるなら カットイン持ちが居ないので draw しない。
    s.players.self.remove = [PLAIN_BLK];
    // mill するのも 非カットイン (MILL_FIL) → mill 後も remove に カットインは存在しない。
    s.players.self.deck = [MILL_FIL, MILL_FIL, MILL_FIL, MILL_FIL, MILL_FIL];
    const deckBefore = s.players.self.deck.length;
    const handBefore = s.players.self.hand.length; // ['B07098']

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07098');
      runAllUntilEmpty(d);
    });

    expect(inScene(s, 'B07098'), 'B07098 登場').toBe(true);
    // mill2 は実行される (条件に依らず常時)
    expect(removeCount(s, MILL_FIL), 'mill2 は実行 (上2枚 remove へ)').toBe(2);
    expect(s.players.self.deck.length, 'deck は mill2 のみ = -2 (draw 無し)').toBe(deckBefore - 2);
    // DECOY 主張: 非カットインしか remove に無い → draw しない。
    //   handUseCard で B07098 が手札を離れるため、登場前後で手札純増0 (draw 0)。
    expect(s.players.self.hand.length, 'カットイン持ち不在 → draw せず (手札は B07098 が抜けて純減のみ)').toBe(handBefore - 1);
    expect(s.players.self.scene.length + s.players.self.hand.length, 'B07098 は scene へ / draw 無し').toBe(1);
  });

  it('a1: mill した2枚の片方が カットイン持ち → そのターン中 remove に カットインが生じ draw する', () => {
    let s = enterBase();
    s.players.self.remove = []; // 初期 remove 空
    // 上2枚の1枚が CUTIN_BLK → mill 後に remove に カットイン持ちが現れ conditional 成立。
    s.players.self.deck = [MILL_FIL, CUTIN_BLK, PLAIN_BLK, MILL_FIL, MILL_FIL];
    const deckBefore = s.players.self.deck.length;

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07098');
      runAllUntilEmpty(d);
    });

    expect(removeCount(s, MILL_FIL) + removeCount(s, CUTIN_BLK), 'mill2 (MILL_FIL + CUTIN_BLK)').toBe(2);
    expect(inRemove(s, CUTIN_BLK), 'mill で CUTIN_BLK が remove へ').toBe(true);
    // mill 後の remove に カットイン持ち有 → 3枚目 (PLAIN_BLK) を draw
    expect(inHand(s, PLAIN_BLK), 'mill 由来の カットイン持ちで draw 成立').toBe(true);
    expect(s.players.self.deck.length, 'deck -3 (mill2+draw1)').toBe(deckBefore - 3);
  });

  // ============================================================
  // a2: 【解決編】【宣言】【ターン1】 cost(黒カットイン手札) → forEach(remove 黒カットイン枚数) AP+1000
  // ============================================================
  it('a2 condition NEGATIVE: 事件編 では宣言不可 (caseStatus 解決編 gate / BUG-099)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07098', 'kanti#1', { state: 'active' })];
    s.players.self.case.status = '事件編'; // 解決編でない
    s.players.self.hand = [CUTIN_BLK]; // cost は払える状態だが…
    expect(canDeclaredAbility(s, 'kanti#1', 'a2'), '事件編 → a2 宣言不可 (条件 unmet)').toBe(false);

    // 解決編にすると宣言可になる (gate が caseStatus を実評価している証明)
    s = produce(s, (d) => { d.players.self.case.status = '解決編'; });
    expect(canDeclaredAbility(s, 'kanti#1', 'a2'), '解決編 → a2 宣言可').toBe(true);
  });

  it('a2 cost DECOY: cost filter {keyword:カットイン, color:黒} 実評価 — 黒カットイン手札のみ payable', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s0.players.self.scene = [sceneChar('B07098', 'kanti#1', { state: 'active' })];
    s0.players.self.case.status = '解決編';
    const a2 = B07098.abilities.find((a) => a.id === 'a2')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B07098', uid: 'kanti#1', abilityId: 'a2', player: 'self', area: 'scene' },
      bindings: {},
    };

    const okHand = produce(s0, (d) => { d.players.self.hand = [CUTIN_BLK]; });
    expect(engineCost.canPay(okHand, a2.cost!, ctx), '黒カットイン手札 → cost 払える').toBe(true);

    // DECOY: 緑カットイン (color違い) → 不可 (color:黒 filter)
    const colorDecoy = produce(s0, (d) => { d.players.self.hand = [CUTIN_GRN]; });
    expect(engineCost.canPay(colorDecoy, a2.cost!, ctx), '緑カットイン → cost 払えない (color:黒 filter)').toBe(false);

    // DECOY: 黒だが 非カットイン (keyword違い) → 不可 (keyword:カットイン filter)
    const kwDecoy = produce(s0, (d) => { d.players.self.hand = [PLAIN_BLK]; });
    expect(engineCost.canPay(kwDecoy, a2.cost!, ctx), '黒の非カットイン → cost 払えない (keyword filter)').toBe(false);

    // 手札0枚 → 不可
    const empty = produce(s0, (d) => { d.players.self.hand = []; });
    expect(engineCost.canPay(empty, a2.cost!, ctx), '手札0枚 → cost 払えない').toBe(false);
  });

  it('a2 + DECOY: 宣言で 黒カットイン手札を cost リムーブ → remove の 黒カットイン枚数分 AP+1000 (color/keyword filter 実評価)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07098', 'kanti#1', { state: 'active' })];
    s.players.self.case.status = '解決編';
    s.players.self.deck = [MILL_FIL, MILL_FIL]; // refresh 回避 (a2 は deck 不使用だが念のため)
    // remove に: 黒カットイン×1 (counted) + 緑カットイン (color filter で除外) + 黒非カットイン (keyword filter で除外)。
    s.players.self.remove = [CUTIN_BLK, CUTIN_GRN, PLAIN_BLK];
    // 手札: cost 用 黒カットイン×1。cost で remove へ移ると 黒カットインが remove 上 2 枚になる。
    s.players.self.hand = [CUTIN_BLK];

    const apBefore = read.char.ap(s, 'kanti#1');
    expect(apBefore, 'base AP 2000').toBe(2000);
    expect(canDeclaredAbility(s, 'kanti#1', 'a2'), 'a2 宣言可 (解決編 + cost 払える)').toBe(true);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'kanti#1', 'a2'); // cost: 黒カットイン手札 → remove / 宣言 emit
      runAllUntilEmpty(d);                          // forEach (remove の 黒カットイン枚数) charModifyAP
    });

    // cost: 黒カットイン手札がリムーブされ remove へ
    expect(inHand(s, CUTIN_BLK), 'cost で黒カットイン手札を消費').toBe(false);
    expect(removeCount(s, CUTIN_BLK), 'remove の黒カットインは seed1 + cost1 = 2 枚').toBe(2);
    // DECOY: 緑カットイン / 黒非カットイン は remove に残るが count されない
    expect(inRemove(s, CUTIN_GRN), '緑カットインは remove に残る').toBe(true);
    expect(inRemove(s, PLAIN_BLK), '黒非カットインは remove に残る').toBe(true);

    // remove の「黒カットイン」= 2 枚 → AP+1000×2 = +2000。緑カットイン(color外)/黒非カットイン(keyword外)は数えない。
    const apAfter = read.char.ap(s, 'kanti#1');
    expect(apAfter, 'AP = 2000 + 1000×(remove の黒カットイン2枚) = 4000 (緑/非カットインは除外)').toBe(4000);
  });

  it('a2 turn-limit NEGATIVE: 【ターン1】— 1回宣言後は declaredUseCount で再宣言不可 (rules/24)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07098', 'kanti#1', { state: 'active' })];
    s.players.self.case.status = '解決編';
    s.players.self.deck = [MILL_FIL, MILL_FIL];
    s.players.self.remove = [];
    s.players.self.hand = [CUTIN_BLK, CUTIN_BLK]; // 2回分の cost を用意

    expect(canDeclaredAbility(s, 'kanti#1', 'a2'), '1回目: 宣言可').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'kanti#1', 'a2');
      runAllUntilEmpty(d);
    });
    // cost を 1 枚しか消費していない (= 1 回だけ宣言した)
    expect(removeCount(s, CUTIN_BLK), '1回宣言: cost 黒カットイン 1 枚消費').toBe(1);
    expect(read.char.declaredUseCount(s, 'kanti#1', 'a2'), 'declaredUseCount a2 = 1').toBe(1);
    // 【ターン1】 → 2回目は宣言不可 (cost は払える手札が残っていても)
    expect(inHand(s, CUTIN_BLK), '2回目分の cost 手札はまだ残っている').toBe(true);
    expect(canDeclaredAbility(s, 'kanti#1', 'a2'), '2回目: 【ターン1】で宣言不可').toBe(false);
  });

  // ============================================================
  // a3: 【カットイン】AP＋1000 — 実 contact で攻撃キャラを AP+1000
  // ============================================================
  it('a3 + DECOY: カットイン手札は canCutIn=true → 実 cut で攻撃キャラ AP+1000 / 非カットイン手札は canCutIn=false', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'action-1', isFirstPlayerFirstTurn: false };
    // 攻撃キャラ (自) = $contact.byUid の AP+1000 対象。base AP 2000。
    s.players.self.scene = [sceneChar('B07098', 'atk', { state: 'sleep' })];
    s.players.opp.scene = [sceneChar('D08017', 'dft', { state: 'sleep' })];
    s.players.self.hand = ['B07098', PLAIN_BLK]; // B07098=カットイン持ち / PLAIN_BLK=非カットイン (decoy)

    const ax: ActionContext = {
      id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 2000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
    };

    // DECOY: 非カットイン手札 (PLAIN_BLK) は cut できない (defHasKeyword('カットイン')=false)
    expect(canCutIn(s, ax, 'self', PLAIN_BLK), '非カットイン手札は cut 不可').toBe(false);
    // カットイン持ち手札 (B07098) は cut 可
    expect(canCutIn(s, ax, 'self', 'B07098'), 'カットイン持ち手札は cut 可').toBe(true);

    const apBefore = read.char.ap(s, 'atk');
    expect(apBefore, 'cut 前 攻撃キャラ AP 2000').toBe(2000);

    s = produce(s, (d) => {
      cutIn(d, ax, 'self', 'B07098'); // effect:declared{abilityId:'cutin'} emit → a3 が pendingEffects へ
      runAllUntilEmpty(d);            // charModifyAP $contact.byUid (=atk) +1000 scope:contact
    });

    // a3 効果: 攻撃キャラ (atk) を AP+1000
    expect(read.char.ap(s, 'atk'), 'cut で攻撃キャラ AP 2000→3000 (a3 【カットイン】AP+1000)').toBe(3000);
    // カットインに使ったカードは remove へ (rules/09)
    expect(inRemove(s, 'B07098'), 'cut に使った B07098 は remove へ').toBe(true);
    // decoy は手札に残る
    expect(inHand(s, PLAIN_BLK), '非カットイン decoy は手札に残る').toBe(true);
  });

  // ============================================================
  // descriptor 構造 sanity (clauseMap と 1:1)
  // ============================================================
  it('descriptor: a1=enter(事件編) mill2+conditional(remove カットイン→draw1), a2=declared(解決編,turn1) cost(黒カットイン)→forEach AP+1000, a3=cutin(AP+1000)', () => {
    const [a1, a2, a3] = B07098.abilities;

    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toMatchObject({ kind: 'caseStatus', status: '事件編' });
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as { steps: Array<Record<string, unknown>> }).steps;
    expect(steps[0]).toMatchObject({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } });
    expect(steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'sceneHas', query: { area: 'remove', side: 'self', filter: { keyword: 'カットイン' } }, nMin: 1 },
      then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });

    // a2
    expect(a2.type).toBe('declared');
    expect(a2.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({
      kind: 'removeFromHand',
      target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { keyword: 'カットイン', color: '黒' } }, n: { min: 1, max: 1 } },
      n: 1,
    });
    expect(a2.effect).toMatchObject({
      kind: 'forEach',
      over: { kind: 'all', query: { area: 'remove', side: 'self', filter: { keyword: 'カットイン', color: '黒' } } },
      do: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
    });

    // a3
    expect(a3.type).toBe('triggered');
    expect(a3.scope).toBe('on-hand');
    expect(a3.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(a3.effect).toMatchObject({
      kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' },
    });
  });
});
