// gate5 RUNTIME behavior — B07057 「時価4億円！」 (event, 白, Lv5)
//
// 公式テキスト (recs/B07057.json):
//   自分の現場にいる〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚手札に移してもよい。
//   そうした場合、キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクション
//   できる）を与え、カードを1枚引く。
//
// rules:
//   13-keywords.md (突撃 = 名乗り状態でもアクション可 / 付与キーワード),
//   15-abilities-effects.md (「〜してもよい」=しない選択可 / 「〜まで」=0枚可 / 「そうした場合」=前段成立時のみ後段),
//   17-icons.md (条件アイコン無し),
//   19-special-rules.md (cardName split-name 判定),
//   20-color-and-switch.md (手札の使用は事件の色制限 — 本イベントは白).
//
// DSL (certify): a1 = triggered scope:'on-hand' trigger:{effect:declared, selfOnly, __eventUse}
//   effect = optional{ chain[ sceneToHand{self,max:1,side:self,filter:{cardName:[黒羽快斗,怪盗キッド]}},
//                              sequence[ draw{self,n:1}, charGrantKeyword{self,max:1,side:either,kw:突撃,scope:turn} ] ] }
//   ※ draw を grant より前に REORDER (certify rationale: draw を無条件化 / commutative)。
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard(self, 'B07057') → effect:declared(event-use) emit → triggered listener が a1 を queue
//   → runAllUntilEmpty。optional ラッパは AI 既定 skip / human は __pendingEffectOptionalSide に surface。
//   human「する」= applyOptionalAndContinuation(state, opt, true) → chain 再 walk:
//     - sceneToHand 候補あり → bounce pick surface (continuation=sequence[draw,grant] 同梱)。
//       pick(黒羽快斗/怪盗キッド) → continuation 実行 → draw +1 + 突撃付与。
//     - sceneToHand 候補なし (黒羽快斗/怪盗キッド 不在) → __chainStepNoApply → chain break → draw/grant skip
//       (= 「そうした場合」忠実: 移すキャラが居なければ後段は走らない)。
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   (1) optional ラッパ:「してもよい」。AI 既定 skip / human opt-out で何も起きない。
//   (2) sceneToHand bounce の filter:{cardName:[黒羽快斗,怪盗キッド]} を engine が **実評価** しているか。
//       DECOY: 別名 (毛利蘭) の自陣キャラは候補外。黒羽快斗 / 怪盗キッド のみ候補。side:'self' で自陣のみ
//       (相手陣の黒羽快斗 decoy は候補外)。
//   (3) bounce 後段「そうした場合、…突撃を与え、カードを1枚引く」: bounce で 1 枚移したとき (=候補 pick)
//       のみ draw +1 + 突撃付与が走る。候補不在 (chain break) では draw も grant も走らない。
//   (4) charGrantKeyword: 突撃 を turn-scope で付与 (side:either)。read.char.hasKeyword で確認。
//       「1枚まで」= grant 対象 0 枚も可 — その場合でも draw は走る (sequence:[draw FIRST, grant])。
//   (5) BUG-111 trap (bounce 0-pick UI decline): bounce 候補が居るのに human が 0 枚 decline (plain skip)
//       した場合、continuation (draw/grant) は drop されるべき (= 1 枚も移していない →「そうした場合」不成立)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import {
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  drainAiEffectPicks,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _peekPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { read } from '@/engine/read/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B07057 } from '@/cards/ct-p07/B07057';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

const FB = { type: 'card-back' as const, cardId: 'FB' };

// ---- synthetic decoy defs (prefix DEC_B07057_, abilities:[] で再帰トリガー無し) ----
function ch(id: string, names: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['白'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

// bounce 候補 (filter cardName 該当):
const KAITO = 'DEC_B07057_KAITO';   // カード名[黒羽快斗] → filter 該当 (有効候補)
const KID = 'DEC_B07057_KID';       // カード名[怪盗キッド] → filter 該当 (有効候補)
// bounce decoy:
const OTHER = 'DEC_B07057_OTHER';   // カード名[毛利蘭] → filter 非該当 (候補外)
// grant 対象 (charGrantKeyword の pick):
const GTGT = 'DEC_B07057_GRANT';    // 突撃付与対象 (任意キャラ, side:either)

function registerDecoys(): void {
  registerCardDef(ch(KAITO, ['黒羽快斗']));
  registerCardDef(ch(KID, ['怪盗キッド']));
  registerCardDef(ch(OTHER, ['毛利蘭']));
  registerCardDef(ch(GTGT, ['付与対象']));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inScene = (s: GameState, side: 'self' | 'opp', cardId: string) =>
  s.players[side].scene.some((c) => c.cardId === cardId);

// 白事件 (rules/20 色) + FILE5 (rules/12 level5 使用可) で B07057 を手札使用可能化する base。
// deck filler を仕込んで draw の対象を観測可能にする。
function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B07057'];
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as GameState['players']['self']['case'];
  s.players.self.file = Array.from({ length: 5 }, () => ({ ...FB })); // FILE5 ≥ level5
  s.players.self.deck = ['drawTarget', 'd2', 'd3']; // draw 観測用 top = drawTarget
  return s;
}

describe('B07057 「時価4億円！」 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== a1 POSITIVE (full): human「する」→ bounce(黒羽快斗) + 突撃付与 + draw =====
  it('a1 する (full): 黒羽快斗を手札へ bounce → 突撃付与 + カード1枚ドロー (filter cardName / 後段 全実行)', () => {
    setHuman('self'); // optional + pick を surface させる
    let s = base();
    s.players.self.scene = [
      sceneChar(KAITO, 'kaito#1', { state: 'active' }), // bounce 候補
      sceneChar(GTGT, 'grant#1', { state: 'active' }),  // 突撃付与対象
    ];
    const handBefore = s.players.self.hand.length;

    // handUseCard → effect:declared(event-use) → a1 queue → runAllUntilEmpty → optional surface
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    expect(inHand(s, 'B07057'), 'B07057 はイベントとして使用済み (手札から消費)').toBe(false);
    expect(s.players.self.remove.includes('B07057'), 'B07057 はリムーブエリアへ (使い切り)').toBe(true);
    const opt = _peekPendingEffectOptionalSide();
    expect(opt, 'optional surface (してもよい)').not.toBeNull();
    expect(opt!.player, 'optional owner = self').toBe('self');

    // 「する」(opt-in) → chain 再 walk → sceneToHand bounce pick surface
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand');
    expect(bounce, 'sceneToHand bounce pick が surface').toBeTruthy();
    // (2) DECOY: 候補は 黒羽快斗 のみ (毛利蘭 decoy は filter cardName 非該当 / GTGT も非該当)
    expect(bounce!.candidates.map((c) => c.cardId).sort(), 'bounce 候補は 黒羽快斗 のみ').toEqual([KAITO]);

    // 黒羽快斗 を pick → continuation (draw + grant) 実行
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, bounce!, 'kaito#1');
    });

    // bounce: 黒羽快斗 が現場から手札へ
    expect(inScene(s, 'self', KAITO), '黒羽快斗 は現場から消えた (bounce)').toBe(false);
    expect(inHand(s, KAITO), '黒羽快斗 は手札へ戻る').toBe(true);

    // (3) draw: 後段の draw が走り、デッキ top (drawTarget) が手札へ
    expect(inHand(s, 'drawTarget'), 'draw: デッキ top が手札へ (+1 ドロー)').toBe(true);
    // 手札枚数: -B07057(使用) -ない + KAITO(bounce) + drawTarget(draw) = handBefore -1 +1 +1
    expect(s.players.self.hand.length, '手札枚数 = 元 -B07057 +黒羽快斗 +ドロー1').toBe(handBefore - 1 + 1 + 1);

    // (4) 突撃付与: grant pick が surface して GTGT に 突撃 付与可能か
    const grant = pickQueue().find((q) => q.atomVerb === 'charGrantKeyword');
    expect(grant, 'charGrantKeyword pick が surface (突撃付与)').toBeTruthy();
    expect(grant!.nMin, '「1枚まで」= 0枚可').toBe(0);
    // 付与対象 GTGT (grant#1) を pick → 突撃 付与
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, grant!, 'grant#1');
    });
    expect(read.char.hasKeyword(s, 'grant#1', '突撃'), 'grant#1 に 突撃 が付与される (turn-scope)').toBe(true);
  });

  // ===== a1: bounce 候補は 怪盗キッド でも該当 (cardName OR membership) =====
  it('a1: 怪盗キッド も bounce 候補 (cardName OR membership) / 毛利蘭 decoy は候補外', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [
      sceneChar(KID, 'kid#1', { state: 'active' }),     // 怪盗キッド = filter 該当
      sceneChar(OTHER, 'other#1', { state: 'active' }), // 毛利蘭 = filter 非該当 decoy
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand')!;
    expect(bounce.candidates.map((c) => c.cardId).sort(), 'bounce 候補は 怪盗キッド のみ (毛利蘭 decoy 除外)').toEqual([KID]);
    expect(bounce.candidates.some((c) => c.cardId === OTHER), 'DECOY 毛利蘭 は候補外 (cardName 非該当)').toBe(false);
  });

  // ===== a1: side:'self' — 相手陣の 黒羽快斗 は bounce 候補外 (「自分の現場にいる」) =====
  it('a1: side:self — 相手陣の 黒羽快斗 は bounce 候補外 / 自陣の 怪盗キッド のみ候補 (「自分の現場にいる」)', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [sceneChar(KID, 'kid#1', { state: 'active' })];   // 自陣 怪盗キッド = 候補
    s.players.opp.scene = [sceneChar(KAITO, 'oppKaito#1', { state: 'active' })]; // 相手陣 黒羽快斗 = decoy(side)

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand')!;
    expect(bounce.candidates.map((c) => c.uid).sort(), '自陣 怪盗キッド のみ候補 (相手陣 黒羽快斗 は side:self で除外)').toEqual(['kid#1']);
    expect(bounce.candidates.some((c) => c.uid === 'oppKaito#1'), 'DECOY 相手陣 黒羽快斗 は候補外 (side:self)').toBe(false);
  });

  // ===== a1: grant 対象 side:either — 相手陣のキャラにも 突撃 を付与できる =====
  it('a1: grant 対象は side:either — 相手陣キャラも 突撃 付与候補 (「キャラを1枚まで」=側指定なし)', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [sceneChar(KAITO, 'kaito#1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(GTGT, 'oppGrant#1', { state: 'active' })]; // 相手陣 grant 対象

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, bounce, 'kaito#1');
    });
    const grant = pickQueue().find((q) => q.atomVerb === 'charGrantKeyword')!;
    // side:either → 自陣 (空) + 相手陣 (oppGrant#1) の両方を候補に。ここでは相手陣のみ存在。
    expect(grant.candidates.some((c) => c.uid === 'oppGrant#1'), 'side:either で相手陣キャラも grant 候補').toBe(true);
    expect(grant.candidates.find((c) => c.uid === 'oppGrant#1')?.player, 'oppGrant#1 は opp 陣').toBe('opp');
  });

  // ===== a1: grant を 0 枚 decline しても draw は走る (sequence:[draw FIRST, grant] / 「1枚まで」=0枚可) =====
  it('a1: 突撃付与を 0 枚 decline しても カード1枚ドローは走る (draw は grant より前 / 「1枚まで」=0枚可)', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [sceneChar(KAITO, 'kaito#1', { state: 'active' })]; // 付与対象なし (bounce のみ)

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, bounce, 'kaito#1');
    });
    // bounce + draw は走り、grant pick は 0 候補 (付与対象 = 黒羽快斗 は bounce 済 → 現場空) で skip 解決される。
    expect(inHand(s, 'drawTarget'), 'draw: bounce 後でも draw は走る (sequence step0)').toBe(true);
    expect(inHand(s, KAITO), '黒羽快斗 は手札へ (bounce)').toBe(true);
  });

  // ===== a1 NEGATIVE (しない / opt-out): bounce も draw も grant も走らない (してもよい) =====
  it('a1 NEGATIVE しない: optional opt-out → bounce / draw / 突撃付与 すべて走らない', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [
      sceneChar(KAITO, 'kaito#1', { state: 'active' }),
      sceneChar(GTGT, 'grant#1', { state: 'active' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, false); // 「移さない」
    });
    expect(inScene(s, 'self', KAITO), 'opt-out: 黒羽快斗 は現場に残る (bounce せず)').toBe(true);
    expect(inHand(s, 'drawTarget'), 'opt-out: ドローしない').toBe(false);
    expect(read.char.hasKeyword(s, 'grant#1', '突撃'), 'opt-out: 突撃 付与されない').toBe(false);
    expect(s.players.self.deck.length, 'opt-out: デッキ枚数不変').toBe(3);
  });

  // ===== a1 NEGATIVE (AI skip): AI 経路では optional 既定 skip → 何も起きない =====
  it('a1 NEGATIVE AI skip: AI 経路 (human=null) → optional 既定 skip → bounce/draw/grant 走らない', () => {
    setHuman(null); // AI 経路
    let s = base();
    s.players.self.scene = [
      sceneChar(KAITO, 'kaito#1', { state: 'active' }),
      sceneChar(GTGT, 'grant#1', { state: 'active' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(_peekPendingEffectOptionalSide(), 'AI: optional surface しない').toBeNull();
    expect(inScene(s, 'self', KAITO), 'AI skip: 黒羽快斗 は現場に残る').toBe(true);
    expect(inHand(s, 'drawTarget'), 'AI skip: ドローしない').toBe(false);
    expect(read.char.hasKeyword(s, 'grant#1', '突撃'), 'AI skip: 突撃 付与されない').toBe(false);
  });

  // ===== a1 chain break (そうした場合 不成立): 黒羽快斗/怪盗キッド 不在 → bounce 候補0 → draw/grant skip =====
  it('a1 chain break: 黒羽快斗/怪盗キッド が現場に居ない (毛利蘭のみ) → bounce 候補0 → 「そうした場合」不成立で draw も 突撃付与も走らない', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [sceneChar(OTHER, 'other#1', { state: 'active' })]; // 毛利蘭 のみ (filter 非該当)

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true); // 「する」を選ぶが bounce 候補が居ない
    });
    // bounce 候補不在 → __chainStepNoApply → chain break → draw/grant は走らない
    expect(pickQueue().some((q) => q.atomVerb === 'sceneToHand'), 'bounce pick は surface しない (候補0)').toBe(false);
    expect(pickQueue().some((q) => q.atomVerb === 'charGrantKeyword'), 'chain break → grant pick も surface しない').toBe(false);
    expect(inHand(s, 'drawTarget'), 'chain break → draw 走らない (「そうした場合」不成立)').toBe(false);
    expect(s.players.self.deck.length, 'chain break: デッキ枚数不変').toBe(3);
    expect(read.char.hasKeyword(s, 'other#1', '突撃'), 'chain break: 突撃 付与されない').toBe(false);
  });

  // ===== a1 BUG-111 trap: bounce 候補あり + human が「移さない」(plain skip) → continuation drop =====
  // ⚠ 公式テキスト「1枚手札に移してもよい。そうした場合、…」: bounce で 1枚も移さなかったら後段は走らない。
  // 実 UI 経路 (useEngineDispatch effectPickResolve, pickedUid:null) は、bounce pick が
  // skipResolvesAtom を持たない (sceneToHand 短縮形は付けない) ため **plain skip** (pending 破棄 →
  // continuation も同梱破棄, BUG-111) を取る。⚠ applyPickSkipAndContinuation (skipResolvesAtom 専用の
  // 「0枚=atom解決+remainder続行」) ではない。後者を誤って呼ぶと draw が走り「そうした場合」を破る
  // (本テストはその真の UI 経路 = plain skip を踏み、後段 drop を実機で確認する)。
  it('a1 BUG-111 trap: bounce pick は skipResolvesAtom を持たず、「移さない」(plain skip = pending 破棄) で continuation (draw/grant) は drop される (1枚も移していない →「そうした場合」不成立)', () => {
    setHuman('self');
    let s = base();
    s.players.self.scene = [
      sceneChar(KAITO, 'kaito#1', { state: 'active' }),
      sceneChar(GTGT, 'grant#1', { state: 'active' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07057');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide()!;
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt, true);
    });
    const bounce = pickQueue().find((q) => q.atomVerb === 'sceneToHand')!;
    expect(bounce.nMin, 'bounce は nMin=0 (UI に「移さない」button が出る)').toBe(0);
    // bounce pick は skipResolvesAtom を持たない → UI 「移さない」(pickedUid:null) は plain skip
    // = pending 破棄 (continuation 同梱も drop)。useEngineDispatch L423-435 の non-skipResolvesAtom 分岐を再現。
    expect(bounce.skipResolvesAtom === true, 'bounce は skipResolvesAtom を持たない (plain skip 経路)').toBe(false);
    // 実 UI の plain-skip: pending を queue から捨てるだけ (continuation も pending 本体に同梱され一緒に drop)
    g.__pendingEffectPickQueue = [];
    // (何も実行しない = pending 破棄。続けて runAllUntilEmpty しても再 push される pick は無い)
    s = produce(s, (d) => {
      runAllUntilEmpty(d);
    });
    // 黒羽快斗 は現場に残る (移していない)。draw / 突撃付与 は走ってはならない (1枚も移していないため)。
    expect(inScene(s, 'self', KAITO), '移さない: 黒羽快斗 は現場に残る (bounce せず)').toBe(true);
    expect(inHand(s, KAITO), '移さない: 黒羽快斗 は手札に入らない').toBe(false);
    expect(inHand(s, 'drawTarget'), '移さない: ドローしない (「そうした場合」不成立)').toBe(false);
    expect(read.char.hasKeyword(s, 'grant#1', '突撃'), '移さない: 突撃 付与されない').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=event-use triggered optional{chain[sceneToHand{self,max1,side:self,cardName[黒羽快斗,怪盗キッド]}, sequence[draw n1, charGrantKeyword 突撃 turn either max1]]}', () => {
    const a1 = B07057.abilities[0];
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.scope, 'a1 scope on-hand (event)').toBe('on-hand');
    expect(a1.trigger, 'a1 effect:declared selfOnly (event-use)').toMatchObject({ hook: 'effect:declared', selfOnly: true });
    expect((a1.effect as { kind: string }).kind, 'a1 optional ラッパ (してもよい)').toBe('optional');
    const chain = (a1.effect as { effect: { kind: string; steps: unknown[] } }).effect;
    expect(chain.kind, '内部 chain (そうした場合 no-apply-break)').toBe('chain');
    const steps = chain.steps as Array<Record<string, unknown>>;
    // step0 = sceneToHand bounce (self, max:1, side:self, cardName OR membership)
    expect(steps[0], 'step0 = sceneToHand bounce').toMatchObject({
      verb: 'sceneToHand',
      args: { player: 'self', max: 1, side: 'self', filter: { cardName: ['黒羽快斗', '怪盗キッド'] } },
    });
    // step1 = sequence[draw FIRST, charGrantKeyword]
    const seq = steps[1] as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.kind, 'step1 = sequence (draw + 突撃付与)').toBe('sequence');
    expect(seq.steps[0], 'sequence step0 = draw n:1 (REORDER: 突撃付与より前=無条件化)').toMatchObject({
      verb: 'draw', args: { player: 'self', n: 1 },
    });
    expect(seq.steps[1], 'sequence step1 = charGrantKeyword 突撃 turn side:either max:1').toMatchObject({
      verb: 'charGrantKeyword',
      args: { player: 'self', max: 1, side: 'either', kw: '突撃', scope: 'turn' },
    });
  });
});
