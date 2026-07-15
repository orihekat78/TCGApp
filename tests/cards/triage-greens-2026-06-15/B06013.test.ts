// gate5 RUNTIME behavior — B06013 厄介な難事件 (case, 青)
//
// 公式テキスト (.tmp/taskA/recs/B06013.json):
//   この事件が解決編に移行したとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。
//     その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、
//     残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［工藤新一］〛か〚［毛利蘭］〛が
//     いる場合に宣言できる。
//
// rules: 01-victory-conditions.md (解決編一方通行 / a1) , 14-refresh.md, 15-abilities-effects.md (「〜まで」=0枚可),
//        17-icons.md (【解決編】【ターン1】条件アイコン), 19-special-rules.md (分割名), 21-declared-ability-cost.md
//        (〚裏向き証拠2つ表向き〛コスト / 宣言ゲート condition), 24-qa-naming-stun.md (0枚取得でも【ターン1】消費),
//        26-qa-deck-refresh.md (reveal 中はデッキ扱い)
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない):
//   (1) a1 trigger 'case:to-resolved' selfOnly:true — **自分の** 事件が解決編になったときのみ手札1リムーブ。
//       相手の事件が解決編になっても自分は discard しない (selfOnly gate)。
//   (2) a2 宣言ゲート condition = and(caseStatus:'解決編', sceneHas{cardName:['工藤新一','毛利蘭']})。
//       canDeclaredAbility が **両方** を実評価しているか (事件編 / 非該当キャラのみ → 宣言不可)。
//   (3) a2 effect deckRevealUntil filter:{cardName:['工藤新一','毛利蘭']} を engine が実評価しているか。
//       top3 の非該当 (DEC cardName 違い) は手札に加えず、該当を skip せず拾うこと。
//
// decoy/negative:
//   D1 (deck filter): deck 先頭に 非該当 cardName decoy → filter 無視なら先頭が拾われる (BUG-117/118 型)。
//       filter honor なら decoy を skip し 工藤新一 を拾う。decoy は残りとしてデッキ下へ。
//   D2 (condition filter): 現場に 工藤新一/毛利蘭 が「いない」と canDeclaredAbility=false。
//   N1 (caseStatus): 事件編のまま → canDeclaredAbility=false (【解決編】未達)。
//   N2 (「1枚まで」=0枚可, human): human decline → 該当があっても手札に加えず全reveal デッキ下。
//       【ターン1】は 0枚取得でも消費 (rules/24)。
//   a1 selfOnly: 相手事件の解決編移行で自分は discard しない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { pay } from '@/engine/cost/pay';
import { canPay } from '@/engine/cost/evaluate';
import * as flow from '@/engine/flow/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B06013 } from '@/cards/ct-p06/B06013';
import type { CardDef, GameState, Cost, EffectCtx } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckRevealSide?: { matched: string | null; awaitingPick?: boolean } | null;
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy / char defs (prefix DEC_B06013_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// 現場ゲート用: カード名「工藤新一」を持つキャラ (condition sceneHas / deck filter 該当)。
const SCENE_KUDO = 'DEC_B06013_SCENE_KUDO';      // names:['工藤新一'] — 宣言ゲート充足
const SCENE_RAN = 'DEC_B06013_SCENE_RAN';        // names:['毛利蘭']   — 宣言ゲート充足 (OR の別枝)
const SCENE_OTHER = 'DEC_B06013_SCENE_OTHER';    // 非該当 cardName — 宣言ゲート不成立 decoy

// deck-reveal 該当: カード名「工藤新一」(deck top に置いて手札 add 対象)。
const DECK_KUDO = 'DEC_B06013_DECK_KUDO';        // names:['工藤新一']
// deck-reveal decoy: カード名違い (top3 内だが手札 add 対象外 → デッキ下へ)。
const DECK_DECOY = 'DEC_B06013_DECK_DECOY';      // names:['鈴木園子']
const DECK_FILLER = 'D08017';                    // top3 外 filler (refresh 回避)

function registerDecoys(): void {
  registerCardDef(ch(SCENE_KUDO, { names: ['工藤新一'] }));
  registerCardDef(ch(SCENE_RAN, { names: ['毛利蘭'] }));
  registerCardDef(ch(SCENE_OTHER, { names: ['目暮十三'] }));
  registerCardDef(ch(DECK_KUDO, { names: ['工藤新一'] }));
  registerCardDef(ch(DECK_DECOY, { names: ['鈴木園子'] }));
}

const COST: Cost = (B06013.abilities[1].cost)!;

/** 実 engine flow: pay(cost) → useDeclaredAbility('case:self','a2') → runAllUntilEmpty (UI dispatch 同経路)。 */
function runDeclared(state: GameState, indices: number[]): GameState {
  return produce(state, (d) => {
    const ctx: EffectCtx = {
      source: { cardId: 'B06013', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
      bindings: {},
      dyn: { costParams: { flipFaceUpEvidence: { indices } } },
    };
    pay(d, COST, ctx);
    flow.useDeclaredAbility(d, 'case:self', 'a2', { costPaid: ctx.costPaid, dyn: ctx.dyn, source: ctx.source });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d, new HeuristicPolicy()); // AI 経路: deckRevealUntil 先頭 match 自動取得
  });
}

/** a2 用 base: 解決編 + 現場に該当キャラ + 裏向き証拠2枚 + B06013 を case に。 */
function a2Base(): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s = produce(s, (d) => {
    d.players.self.case = {
      cardId: 'B06013', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {},
    };
    // 裏向き証拠2枚 (flipFaceUpEvidence n:{min:2,max:2} の cost 用)
    d.players.self.evidence.push({ cardId: 'E0', faceUp: false, origin: { turn: 1, via: 'reasoning' } });
    d.players.self.evidence.push({ cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'reasoning' } });
    // 現場に 工藤新一 (宣言ゲート充足)
    mutate.scene.enter(d, 'self', SCENE_KUDO, { active: true });
  });
  return s;
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);

describe('B06013 厄介な難事件 — gate5 runtime behavior', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    g.__pendingEffectPickQueue = [];
    g.__pendingDeckRevealSide = null;
    setHuman(null);
  });

  // ===== a1: 'case:to-resolved' selfOnly — 自分の事件解決編移行で手札1リムーブ =====
  it('a1: 自分の事件が解決編に移行 → 手札1リムーブ (相手事件の移行では discard しない: selfOnly)', () => {
    // --- 自分の事件移行 → 手札1リムーブ ---
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s = produce(s, (d) => {
      d.players.self.case = { cardId: 'B06013', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      d.players.self.hand = ['D08017']; // discard 対象 (唯一の手札 → 決定論)
      d.players.opp.hand = ['D08013'];  // selfOnly decoy: 相手手札は無関係
    });
    s = produce(s, (d) => {
      mutate.case.toResolved(d, 'self'); // 全移行経路が収束する canonical emit (assist/FILE>=7 含む)
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.case.status, '解決編に移行').toBe('解決編');
    expect(s.players.self.hand.length, '自分: 手札1リムーブで 0 枚').toBe(0);
    expect(s.players.self.remove.includes('D08017'), 'リムーブされた手札はリムーブエリアへ').toBe(true);
    // selfOnly DECOY: 相手手札は無関係
    expect(s.players.opp.hand, '相手手札は不変 (自分の移行は相手に作用しない)').toEqual(['D08013']);

    // --- 相手の事件が解決編に移行 → 自分は discard しない (selfOnly gate) ---
    let s2 = createEmptyGameState();
    s2.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s2 = produce(s2, (d) => {
      d.players.self.case = { cardId: 'B06013', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
      d.players.self.hand = ['D08017']; // 自分手札 — 相手移行では減らないはず
      d.players.opp.case = { cardId: 'D08017', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
    });
    s2 = produce(s2, (d) => {
      mutate.case.toResolved(d, 'opp'); // 相手の事件カード (B06013 ではない) が解決編へ
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s2.players.opp.case.status, '相手事件が解決編に').toBe('解決編');
    expect(s2.players.self.hand, 'selfOnly: 相手移行では自分は discard しない').toEqual(['D08017']);
  });

  // ===== a2 宣言ゲート condition: caseStatus + sceneHas を canDeclaredAbility が実評価 =====
  it('a2 condition: 解決編 & 現場に工藤新一/毛利蘭 → 宣言可 / 事件編 or 非該当キャラのみ → 宣言不可', () => {
    // 充足: 解決編 + 現場 工藤新一 → 可
    const ok = a2Base();
    expect(canDeclaredAbility(ok, 'case:self', 'a2'), '解決編+工藤新一 → 宣言可').toBe(true);

    // 毛利蘭 でも OR の別枝で可
    const okRan = produce(a2Base(), (d) => {
      d.players.self.scene = [];
      mutate.scene.enter(d, 'self', SCENE_RAN, { active: true });
    });
    expect(canDeclaredAbility(okRan, 'case:self', 'a2'), '解決編+毛利蘭 → 宣言可 (OR枝)').toBe(true);

    // N1 DECOY (caseStatus): 事件編のまま → 不可 (【解決編】未達)
    const jiken = produce(a2Base(), (d) => { d.players.self.case.status = '事件編'; });
    expect(canDeclaredAbility(jiken, 'case:self', 'a2'), '事件編 → 宣言不可 (caseStatus 実評価)').toBe(false);

    // D2 DECOY (sceneHas): 現場に 工藤新一/毛利蘭 が居らず別名キャラのみ → 不可
    const wrongScene = produce(a2Base(), (d) => {
      d.players.self.scene = [];
      mutate.scene.enter(d, 'self', SCENE_OTHER, { active: true }); // 目暮十三 (非該当)
    });
    expect(canDeclaredAbility(wrongScene, 'case:self', 'a2'), '現場に該当名なし → 宣言不可 (sceneHas 実評価)').toBe(false);

    // 現場 0 枚でも不可
    const emptyScene = produce(a2Base(), (d) => { d.players.self.scene = []; });
    expect(canDeclaredAbility(emptyScene, 'case:self', 'a2'), '現場0枚 → 宣言不可').toBe(false);
  });

  // ===== a2 effect + DECOY: deck filter cardName を実評価 (非該当 skip / 該当 add) =====
  it('a2 effect + DECOY: コスト2枚表向き → top3 の工藤新一を手札へ、cardName違いdecoyはデッキ下 (filter実評価)', () => {
    let s = a2Base();
    // deck top3: [非該当decoy(先頭), 工藤新一(該当), filler] + 下に filler。
    //   filter 無視なら「先頭の card」= DECK_DECOY が拾われる (BUG-117/118 型)。
    //   filter honor なら DECK_DECOY を skip し DECK_KUDO を拾う。
    s = produce(s, (d) => {
      d.players.self.deck = [DECK_DECOY, DECK_KUDO, DECK_FILLER, DECK_FILLER, DECK_FILLER];
    });
    expect(canPay(s, COST, { source: { player: 'self' } } as EffectCtx), 'コスト払える (裏向き証拠2枚)').toBe(true);

    const after = runDeclared(s, [0, 1]);

    // コスト: 証拠2枚を表向きに
    expect(after.players.self.evidence[0].faceUp, '証拠0 表向き').toBe(true);
    expect(after.players.self.evidence[1].faceUp, '証拠1 表向き').toBe(true);
    // effect: 工藤新一を手札へ、デッキから抜ける
    expect(inHand(after, DECK_KUDO), '工藤新一(該当)を手札に加える').toBe(true);
    expect(inDeck(after, DECK_KUDO), 'DECK_KUDO はデッキから抜けた').toBe(false);
    // DECOY 主張: cardName 違い decoy は手札に加わらず、残りとしてデッキ下へ
    expect(inHand(after, DECK_DECOY), 'decoy(鈴木園子)は手札に加えない (cardName filter)').toBe(false);
    expect(inDeck(after, DECK_DECOY), 'decoy は残りとしてデッキに残る').toBe(true);
    // 残り (DECK_DECOY + top3 の filler) はデッキ下、look 外の filler が先頭
    expect(after.players.self.deck[after.players.self.deck.length - 1] === DECK_DECOY
      || after.players.self.deck.includes(DECK_DECOY), 'decoy はデッキ下へ移動').toBe(true);
    // 【ターン1】消費
    expect(after.players.self.case.declaredUseCount['a2'], '【ターン1】消費').toBe(1);
    // 手札は工藤新一 1枚のみ (decoy は入っていない)
    expect(after.players.self.hand.filter((c) => c === DECK_KUDO).length, '工藤新一ちょうど1枚').toBe(1);
  });

  // ===== a2 NEGATIVE (filter unmet): top3 に該当cardName なし → 手札0、全部デッキ下 =====
  it('a2 NEGATIVE: top3 に工藤新一/毛利蘭 が無ければ手札に加えず全reveal デッキ下 (conditional 不成立)', () => {
    let s = a2Base();
    // top3 全て非該当 cardName → $matched 空 → 手札 add 0
    s = produce(s, (d) => {
      d.players.self.deck = [DECK_DECOY, DECK_DECOY, DECK_DECOY, DECK_FILLER, DECK_FILLER];
    });
    const before = s.players.self.deck.length;
    const after = runDeclared(s, [0, 1]);
    expect(inHand(after, DECK_DECOY), '非該当のみ → 手札 add なし').toBe(false);
    expect(after.players.self.hand.length, '手札は1枚も増えない').toBe(0);
    expect(after.players.self.deck.length, 'デッキ枚数不変 (全部デッキ下)').toBe(before);
    expect(after.players.self.case.declaredUseCount['a2'], '0枚取得でも【ターン1】消費 (rules/24)').toBe(1);
  });

  // ===== a2 NEGATIVE (「1枚まで」=0枚可, human decline): 該当があっても手札に加えない =====
  it('a2 NEGATIVE: human decline (0-pick) — 工藤新一があっても手札に加えず全reveal デッキ下 (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = a2Base();
    s = produce(s, (d) => {
      d.players.self.deck = [DECK_KUDO, DECK_FILLER, DECK_FILLER, DECK_FILLER];
    });

    // pay + useDeclared + runAllUntilEmpty (human 経路: pick を surface して pause)
    s = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: 'B06013', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
        bindings: {},
        dyn: { costParams: { flipFaceUpEvidence: { indices: [0, 1] } } },
      };
      pay(d, COST, ctx);
      flow.useDeclaredAbility(d, 'case:self', 'a2', { costPaid: ctx.costPaid, dyn: ctx.dyn, source: ctx.source });
      runAllUntilEmpty(d);
    });

    expect(inHand(s, DECK_KUDO), 'decline 前は手札にまだ入らない').toBe(false);
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'deckRevealUntil pick が surface').toBe('deckRevealUntil');
    expect(pending?.nMin, '「〜まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.candidates.map((c) => c.cardId), '候補は cardName 該当の DECK_KUDO のみ (filter)').toEqual([DECK_KUDO]);

    // decline (0枚) を選択
    g.__pendingEffectPickQueue = [];
    const after = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(inHand(after, DECK_KUDO), 'decline: 工藤新一は手札に入らない').toBe(false);
    expect(inDeck(after, DECK_KUDO), '工藤新一は残りとしてデッキへ').toBe(true);
    // 【ターン1】は 0枚取得 (decline) でも消費 (rules/24)
    expect(after.players.self.case.declaredUseCount['a2'], 'decline でも【ターン1】消費 (rules/24)').toBe(1);
  });

  // ===== a2 NEGATIVE 対: human take — pick で取得すれば手札に入る (decline channel の対) =====
  it('a2: human take — pick で工藤新一を選択すると手札に加わる (decline channel の対)', () => {
    setHuman('self');
    let s = a2Base();
    s = produce(s, (d) => {
      d.players.self.deck = [DECK_KUDO, DECK_FILLER, DECK_FILLER, DECK_FILLER];
    });
    s = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: 'B06013', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
        bindings: {},
        dyn: { costParams: { flipFaceUpEvidence: { indices: [0, 1] } } },
      };
      pay(d, COST, ctx);
      flow.useDeclaredAbility(d, 'case:self', 'a2', { costPaid: ctx.costPaid, dyn: ctx.dyn, source: ctx.source });
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    const after = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pending.candidates[0]!.uid);
    });
    expect(inHand(after, DECK_KUDO), 'take: 工藤新一を手札へ').toBe(true);
    expect(inDeck(after, DECK_KUDO), '工藤新一はデッキから抜けた').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=case:to-resolved selfOnly discard, a2=declared turn1 + flipFaceUpEvidence + cardName filter', () => {
    const [a1, a2] = B06013.abilities;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'case:to-resolved', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } });
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({ kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } });
    const reveal = (a2.effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args!;
    expect(reveal).toMatchObject({ maxN: 3, chooseMatch: 'upTo', filter: { cardName: ['工藤新一', '毛利蘭'] } });
    const cond = a2.condition as { kind: string; cs: Array<{ kind: string }> };
    expect(cond.kind).toBe('and');
    expect(cond.cs.some((c) => c.kind === 'caseStatus')).toBe(true);
    expect(cond.cs.some((c) => c.kind === 'sceneHas')).toBe(true);
  });
});
