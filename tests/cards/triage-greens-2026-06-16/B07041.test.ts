// gate5 RUNTIME behavior — B07041 黒羽盗一 (character, 白, Lv7 AP6000 LP1, 特徴[マジシャン])
//
// 公式テキスト:
//   a1 【パートナー白】【登場時】キャラを1枚まで選び、スタンさせる。
//        （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   a2 【宣言】【スリープ】：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを
//        上から1枚裏向きでセットする。
//
// rules:
//   03-field-areas.md  (状態: active/sleep/stun, スタン特殊挙動 — active 化で代わりに sleep / stun に stun は stun のまま),
//   05-turn-phases.md  (登場 = enter),
//   12-next-hint.md / 20-color-and-switch.md (手札の使用 = 事件色制限 + FILE ≥ level),
//   15-abilities-effects.md (「〜枚まで」=0枚可 / 「〜する」=必須),
//   16-card-set.md     (カードのセット = setCards に追加 / 裏向きセット = faceUp:false / 自デッキ上端から),
//   17-icons.md        (【パートナー白】= 条件アイコン: 未達なら能力を持たない扱い / 【宣言】【スリープ】= コスト),
//   21-declared-ability-cost.md (【スリープ】コスト = 自身スリープ / コストはすべて行う / sleep/stun では使用不可),
//   24-qa-naming-stun.md (スタン特殊挙動の再掲).
//
// 検証の核 (BUG-117/118 教訓: DSL に書いても engine が評価する保証はない — 実機 flow を踏んで盤面で確かめる):
//   a1 が enter (selfOnly) で発火し sceneSetState{state:'stun'} を engine が **実適用** するか
//      (選んだキャラが active→stun になる。sleep でも active でもなく **stun**)。
//   a1 pick の target side:'either' を engine が **実評価** しているか
//      (自分の現場キャラも 相手の現場キャラも候補に出る — side:'either')。
//   a1 condition {kind:'partnerColor', color:'白'} を engine が **実評価** しているか
//      (パートナーが白でなければ a1 は **発火しない** — NEGATIVE)。
//   a1 「1枚まで」=0枚可 — human decline (0-pick) で **誰もスタンしない** (NEGATIVE channel)。
//   a1 スタン特殊挙動 (rules/03/24) — 既に stun のキャラに stun を適用しても **stun のまま**。
//   a2 が declared + sleepSelf コストで発火し charSetCard{fromDeckTop, faceUp:false} を engine が
//      **実適用** するか (選んだ自陣キャラに 自デッキ上端 1 枚が **裏向きで setCards に積まれ** デッキから抜ける)。
//   a2 pick の side:'self' を engine が **実評価** しているか
//      (DECOY: 相手の現場キャラは候補に **入らない** = 「自分の現場にいるキャラ」)。
//   a2 「1枚まで」=0枚可 — human decline (0-pick) で **デッキ上端が消費されず セットも起きない**。
//      ⚠ a2 は単一 atom (trailing step 無し) なので BUG-111 連鎖 trap は無い。0-pick なら全体が no-op。
//   a2 コスト【スリープ】 — active でないと cost.canPay=false (rules/21: sleep/stun では使用不可)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { cost as engineCost } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B07041 } from '@/cards/ct-p07/B07041';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

const FB = { type: 'card-back' as const, cardId: 'FB' };

// ---- synthetic defs (prefix DEC_B07041_ で id 衝突回避。abilities:[] = 再帰トリガー無し) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function partner(id: string, color: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color],
    level: 0, ap: 0, lp: 7, traits: [], keywords: [], rarity: 'P',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

// a1: 自陣の被スタン候補 (active) / 相手陣の被スタン候補 (side:'either' 検証) / 既 stun 候補。
const SELF_TARGET = 'DEC_B07041_SELF_TARGET';   // 自陣 active キャラ → stun 化される
const OPP_TARGET = 'DEC_B07041_OPP_TARGET';     // 相手陣 active キャラ → side:'either' 候補証明
// a2: 自陣の被セット候補 / 相手陣 DECOY (side:'self' 違反 → 候補外)。
const A2_SELF = 'DEC_B07041_A2_SELF';           // 自陣キャラ → セット先候補
const A2_OPP = 'DEC_B07041_A2_OPP';             // 相手陣キャラ → side:'self' DECOY (候補外)
const DECKTOP = 'DEC_B07041_DECKTOP';           // 自デッキ上端 → 裏向きセットされる card
const DECKNEXT = 'DEC_B07041_DECKNEXT';         // デッキ2枚目 → セットされないことを証明
// partner defs
const PARTNER_WHITE = 'DEC_B07041_PARTNER_WHITE'; // 白 → 【パートナー白】成立
const PARTNER_RED = 'DEC_B07041_PARTNER_RED';     // 赤 → 【パートナー白】未達 (NEGATIVE)

function registerDecoys(): void {
  registerCardDef(ch(SELF_TARGET, { colors: ['緑'] }));
  registerCardDef(ch(OPP_TARGET, { colors: ['赤'] }));
  registerCardDef(ch(A2_SELF, { colors: ['緑'] }));
  registerCardDef(ch(A2_OPP, { colors: ['赤'] }));
  registerCardDef(ch(DECKTOP, { colors: ['黄'] }));
  registerCardDef(ch(DECKNEXT, { colors: ['黄'] }));
  registerCardDef(partner(PARTNER_WHITE, '白'));
  registerCardDef(partner(PARTNER_RED, '赤'));
}

// 【登場時】(a1) 発火用 base: B07041 (白/L7) を手札から登場 (handUseCard)。
// 事件白 (rules/20 色制限) + FILE7 (rules/12 level7 使用可)。partner は呼出側が指定。
function enterBase(partnerId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B07041'];
  s.players.self.partner.cardId = partnerId;
  s.players.self.case.colors = ['白'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7 (rules/12)
  s.players.self.deck = ['x1', 'x2'];                 // a1 は deck を触らない (filler)
  return s;
}

// 【宣言】(a2) 発火用 base: B07041 を自現場に active で host。
function a2Base(deck: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B07041', 'touichi#1', { state: 'active' })];
  s.players.self.deck = deck;
  return s;
}

const sceneState = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid)?.state;
const findChar = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid);

describe('B07041 黒羽盗一 — gate5 runtime behavior', () => {
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
    setHuman(null);
  });

  // ===========================================================================
  // a1 + DECOY (side:'either'): 登場で pick が surface — 自陣 active / 相手陣 active 両方が候補
  // ===========================================================================
  it('a1 + DECOY: 【パートナー白】で登場 → sceneSetState pick が surface、候補は 自陣 active(SELF_TARGET) と 相手陣 active(OPP_TARGET) の両方 (side:either) / 「1枚まで」=0枚可', () => {
    setHuman('self'); // human 経路で候補集合を覗く
    let s = enterBase(PARTNER_WHITE);
    s.players.self.scene = [sceneChar(SELF_TARGET, 'self-t', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_TARGET, 'opp-t', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07041'); // 登場 → enter emit → a1 発火 (partnerColor白 成立)
      runAllUntilEmpty(d);              // human 経路: sceneSetState pick を surface して pause
    });

    // B07041 が現場に登場 (trigger 前提)
    expect(s.players.self.scene.some((c) => c.cardId === 'B07041'), 'B07041 が登場').toBe(true);

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneSetState pick が surface (= a1 発火)').toBe('sceneSetState');
    expect(pending?.player, '操作者 = self (a1 所有者)').toBe('self');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.nMax, 'max 1').toBe(1);
    // DECOY 主張: side:'either' → 自陣 active も 相手陣 active も候補。
    const candUids = pending!.candidates.map((c) => c.uid);
    expect(candUids, '自陣 active (SELF_TARGET) は候補 (side:either)').toContain('self-t');
    expect(candUids, '相手陣 active (OPP_TARGET) も候補 (side:either)').toContain('opp-t');
    // B07041 自身 (active で登場、uid は handUseCard が採番) も side:'either' / filter 無し → 候補に含む。
    const selfUid = s.players.self.scene.find((c) => c.cardId === 'B07041')!.uid;
    expect(candUids, 'B07041 自身 (active, 無 filter) も候補').toContain(selfUid);
  });

  // ===========================================================================
  // a1: pick で 相手陣 active キャラを選択 → stun になる (state:'stun' 実適用 / sleep/active ではない)
  // ===========================================================================
  it('a1: 相手陣 active(OPP_TARGET) を選択 → stun になる (state:stun 実適用) / 自陣 SELF_TARGET は active のまま', () => {
    setHuman('self');
    let s = enterBase(PARTNER_WHITE);
    s.players.self.scene = [sceneChar(SELF_TARGET, 'self-t', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_TARGET, 'opp-t', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const oppCand = pending.candidates.find((c) => c.uid === 'opp-t')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, oppCand.uid);
    });

    // state:'stun' を engine が実適用 (active→stun)。sleep でも active でもない。
    expect(sceneState(s, 'opp-t'), '選んだ相手キャラは stun になる (active→stun)').toBe('stun');
    // 選ばなかった自陣キャラは active のまま (1枚のみスタン)。
    expect(sceneState(s, 'self-t'), '選ばなかった SELF_TARGET は active のまま').toBe('active');
  });

  // ===========================================================================
  // a1 stun特殊挙動 (rules/03/24): 既に stun のキャラを選んでも stun のまま
  // ===========================================================================
  it('a1 stun特殊挙動: 既に stun の自陣キャラを選択 → stun のまま (rules/03/24: stun に stun を適用しても stun)', () => {
    setHuman('self');
    let s = enterBase(PARTNER_WHITE);
    // SELF_TARGET を最初から stun にしておく。
    s.players.self.scene = [sceneChar(SELF_TARGET, 'self-t', { state: 'stun' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const stunCand = pending.candidates.find((c) => c.uid === 'self-t')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, stunCand.uid);
    });

    expect(sceneState(s, 'self-t'), '既 stun キャラは stun のまま (rules/03/24)').toBe('stun');
  });

  // ===========================================================================
  // a1 NEGATIVE (condition partnerColor): パートナーが白でないと a1 は発火しない
  // ===========================================================================
  it('a1 NEGATIVE (partnerColor): パートナーが赤 (非白) → 登場しても sceneSetState pick が立たない / 候補キャラは active のまま', () => {
    setHuman('self');
    let s = enterBase(PARTNER_RED); // 赤 partner → 【パートナー白】未達 (rules/17: 能力を持たない扱い)
    s.players.self.scene = [sceneChar(SELF_TARGET, 'self-t', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_TARGET, 'opp-t', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07041');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.some((c) => c.cardId === 'B07041'), 'B07041 自体は登場する').toBe(true);
    expect(pickQueue().length, '赤パートナー → a1 非発火 (partnerColor白 gate)').toBe(0);
    expect(sceneState(s, 'self-t'), 'a1 不発 → SELF_TARGET は active のまま').toBe('active');
    expect(sceneState(s, 'opp-t'), 'a1 不発 → OPP_TARGET も active のまま').toBe('active');
  });

  // ===========================================================================
  // a1 NEGATIVE (0-pick): 「1枚まで」=0枚可 — human decline で誰もスタンしない
  // ===========================================================================
  it('a1 NEGATIVE (0-pick): human decline → 候補キャラが居ても誰もスタンしない (「1枚まで」=0枚可)', () => {
    setHuman('self');
    let s = enterBase(PARTNER_WHITE);
    s.players.self.scene = [sceneChar(SELF_TARGET, 'self-t', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_TARGET, 'opp-t', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'pick surface').toBe('sceneSetState');
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (decline)
    });

    // a2 と異なり a1 は単一 atom。0-pick なら何もスタンされない (trailing step 無し)。
    expect(sceneState(s, 'self-t'), 'decline: SELF_TARGET は active のまま').toBe('active');
    expect(sceneState(s, 'opp-t'), 'decline: OPP_TARGET も active のまま').toBe('active');
  });

  // ===========================================================================
  // a2 + DECOY (side:'self'): 宣言で pick が surface — 自陣キャラのみ候補、相手陣は候補外
  // ===========================================================================
  it('a2 + DECOY: 【宣言】【スリープ】で charSetCard pick が surface、候補は 自陣キャラ(B07041自身 + A2_SELF) のみ / 相手陣 A2_OPP は候補外 (side:self) / cost【スリープ】で自身sleep', () => {
    setHuman('self');
    let s = a2Base([DECKTOP, DECKNEXT]);
    s.players.self.scene.push(sceneChar(A2_SELF, 'a2self', { state: 'active' }));
    s.players.opp.scene = [sceneChar(A2_OPP, 'a2opp', { state: 'active' })]; // DECOY: 相手陣

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'touichi#1', 'a2'); // cost sleepSelf pay + effect:declared queue
      runAllUntilEmpty(d);                           // human 経路: charSetCard pick を surface
    });

    // cost【スリープ】: B07041 自身が sleep (rules/21 cost-first)
    expect(sceneState(s, 'touichi#1'), 'cost【スリープ】: B07041 自身が sleep').toBe('sleep');

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'charSetCard pick が surface (= a2 発火)').toBe('charSetCard');
    expect(pending?.player, '操作者 = self (controller)').toBe('self');
    expect(pending?.nMin, '「1枚まで」=0枚可').toBe(0);
    expect(pending?.nMax, 'max 1').toBe(1);
    const candUids = pending!.candidates.map((c) => c.uid).sort();
    // DECOY 主張: side:'self' → 自陣キャラのみ。相手陣 (A2_OPP) は候補外。
    expect(candUids, '相手陣 A2_OPP (side:self 違反) は候補外').not.toContain('a2opp');
    expect(candUids, '自陣 A2_SELF は候補').toContain('a2self');
    // B07041 自身 (sleep だが「自分の現場にいるキャラ」= 状態 filter 無し) も候補。
    expect(candUids, 'B07041 自身 (自陣) も候補 (状態 filter 無し)').toContain('touichi#1');
  });

  // ===========================================================================
  // a2: pick で自陣キャラを選択 → 自デッキ上端1枚が裏向きで setCards に積まれ、デッキから抜ける
  // ===========================================================================
  it('a2: 自陣 A2_SELF を選択 → 自デッキ上端(DECKTOP)が裏向き(faceUp:false)で setCards に積まれ、デッキから抜ける / 2枚目(DECKNEXT)はデッキに残る', () => {
    setHuman('self');
    let s = a2Base([DECKTOP, DECKNEXT]);
    s.players.self.scene.push(sceneChar(A2_SELF, 'a2self', { state: 'active' }));

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'touichi#1', 'a2');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const selfCand = pending.candidates.find((c) => c.uid === 'a2self')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, selfCand.uid);
    });

    const target = findChar(s, 'a2self')!;
    // 自デッキ上端 (DECKTOP) が setCards に積まれた (rules/16 セット)。
    expect(target.setCards.length, 'A2_SELF に 1 枚セットされた').toBe(1);
    expect(target.setCards[0]?.cardId, 'セットされたのは自デッキ上端 DECKTOP').toBe(DECKTOP);
    expect(target.setCards[0]?.faceUp, '裏向きセット (faceUp:false)').toBe(false);
    // DECKTOP はデッキから抜けた / 2枚目 DECKNEXT はデッキに残る (上端1枚のみ)。
    expect(s.players.self.deck.includes(DECKTOP), 'DECKTOP はデッキから抜けた').toBe(false);
    expect(s.players.self.deck.includes(DECKNEXT), '2枚目 DECKNEXT はデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ 2→1 (上端1枚のみ消費)').toBe(1);
  });

  // ===========================================================================
  // a2 NEGATIVE (0-pick): 「1枚まで」=0枚可 — human decline で デッキ上端も消費されずセットも起きない
  // ===========================================================================
  it('a2 NEGATIVE (0-pick): human decline → どのキャラにもセットされず、自デッキ上端も消費されない (単一 atom = 全体 no-op) / cost【スリープ】は支払済', () => {
    setHuman('self');
    let s = a2Base([DECKTOP, DECKNEXT]);
    s.players.self.scene.push(sceneChar(A2_SELF, 'a2self', { state: 'active' }));
    const deckBefore = [...s.players.self.deck];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'touichi#1', 'a2');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (decline)
    });

    // cost は支払済み (rules/21: cost-first、decline でも巻き戻らない)。
    expect(sceneState(s, 'touichi#1'), 'cost【スリープ】は支払済み (decline でも自身 sleep)').toBe('sleep');
    // decline: 誰にもセットされない (single atom の 0-pick = 全体 no-op、trailing step 無し)。
    expect(findChar(s, 'a2self')!.setCards.length, 'decline: A2_SELF にセットされない').toBe(0);
    expect(findChar(s, 'touichi#1')!.setCards.length, 'decline: B07041 自身にもセットされない').toBe(0);
    // 自デッキ上端は消費されない (fromDeckTop は pick 確定後にのみ shift される)。
    expect(s.players.self.deck, 'decline: 自デッキ上端も消費されず不変').toEqual(deckBefore);
  });

  // ===========================================================================
  // a2 cost gate (rules/21): active でないと sleepSelf cost を払えない (sleep/stun では使用不可)
  // ===========================================================================
  it('a2 cost gate: B07041 が sleep/stun だと cost【スリープ】を支払えない (canPay=false) — active のときのみ支払可', () => {
    const sActive = a2Base([DECKTOP]);
    const sSleep = a2Base([DECKTOP]);
    sSleep.players.self.scene[0]!.state = 'sleep';
    const sStun = a2Base([DECKTOP]);
    sStun.players.self.scene[0]!.state = 'stun';

    const ctx: EffectCtx = {
      source: { cardId: 'B07041', uid: 'touichi#1', abilityId: 'a2', player: 'self', area: 'scene' },
      bindings: {},
    };
    const sleepCost = B07041.abilities[1].cost!;

    // canDeclaredAbility 自体は存在+limit のみ判定 (active 不問) — cost は別 gate。
    expect(canDeclaredAbility(sActive, 'touichi#1', 'a2'), 'canDeclaredAbility = true (存在判定)').toBe(true);
    // 実際の使用可否は cost.canPay で決まる (rules/21: コストを全て行えなければ使用不可)。
    expect(engineCost.canPay(sActive, sleepCost, ctx), 'active → sleepSelf cost 支払可').toBe(true);
    expect(engineCost.canPay(sSleep, sleepCost, ctx), 'sleep → 既に sleep なので支払不可 (rules/21)').toBe(false);
    expect(engineCost.canPay(sStun, sleepCost, ctx), 'stun → sleep にできず支払不可 (rules/21)').toBe(false);
  });

  // ===========================================================================
  // descriptor 構造 sanity (B03079 GOLD 同様の toMatchObject)
  // ===========================================================================
  it('descriptor: a1=triggered enter(selfOnly)+partnerColor白+sceneSetState{$pick,stun,side:either,0..1}, a2=declared sleepSelf+charSetCard{self,fromDeckTop,裏向き,max1}', () => {
    const [a1, a2] = B07041.abilities;
    // a1
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.scope, 'a1 on-scene').toBe('on-scene');
    expect(a1.trigger, 'a1 enter selfOnly').toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition, 'a1 condition partnerColor 白').toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(a1.effect, 'a1 sceneSetState $pick stun / side:either / 0..1 / chooser:self').toMatchObject({
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        uid: '$pick',
        state: 'stun',
        target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
      },
    });
    // a2
    expect(a2.type, 'a2 declared').toBe('declared');
    expect(a2.scope, 'a2 on-scene').toBe('on-scene');
    expect(a2.cost, 'a2 cost sleepSelf').toMatchObject({ kind: 'sleepSelf' });
    expect(a2.limit, 'a2 no 【ターンN】 limit (テキストに印字無し)').toBeUndefined();
    expect(a2.effect, 'a2 charSetCard self / max1 / side:self / fromDeckTop / faceUp:false (裏向き)').toMatchObject({
      kind: 'atom',
      verb: 'charSetCard',
      args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false },
    });
  });
});
