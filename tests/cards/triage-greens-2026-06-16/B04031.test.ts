// gate5 RUNTIME behavior — B04031 中森青子 (character, 白/高校生, L7 AP5000 LP1)
//
// 公式テキスト:
//   【宣言】【スリープ】：〚カード名［黒羽快斗］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、
//     〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//
// rules: 13-keywords.md (突撃 = 名乗り例外キーワード) / 15-abilities-effects.md (「〜まで」=0枚可) /
//        17-icons.md (条件/回数アイコン) / 19-special-rules.md (split-name cardName 判定) /
//        21-declared-ability-cost.md (【宣言】コストはすべて行う / 一部でも不可なら使用不可 /
//          sleep コストは active キャラのみ払える、sleep/stun は払えない) /
//        24-qa-naming-stun.md (突撃 = 登場ターンからアクション可).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   activateDeclaredAbility(d, '<B04031 uid>', 'a1') →
//     cost pay (sleepSelf) + useDeclaredAbility が effect:declared を queue →
//     runAllUntilEmpty で sequence を walk:
//       step1 charModifyAP 短縮形 (uid 不在 + delta1000 + max1) → paShortFormAwait で pick を surface
//       (human: __humanPlayerSide で pick 集合を覗き、applyPick で確定 → bind:'$picked' writeback)
//       step2 charGrantKeyword{uid:'$picked.uid'} → resolveBindRef('$picked.uid') → mutate.char.grantKeyword
//   これは 1 pick を 2 atom が共有する pick-share (BUG-130 → Task D E0 pick-bind writeback で解決済)。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が実評価する保証はない):
//   (A-filter) charModifyAP filter {cardName:'黒羽快斗'} を engine が **実評価** しているか。
//              candidates.ts:260 が cardName を split-name 込みで実評価 (rules/19)。
//              → DECOY: 非「黒羽快斗」キャラ (合成 別名) は **候補に出ない**。黒羽快斗 のみ候補。
//   (A-pick)   黒羽快斗 を pick → step1 で AP+1000 (read.char.ap) かつ step2 で 突撃 を取得
//              (read.char.hasKeyword)。pick-share が同一 picked キャラへ両 atom を適用。
//   (A-decoy)  非該当 decoy は AP 不変 かつ 突撃 を持たない (片方だけでなく両方 no-op)。
//   (COST)     【スリープ】= sleepSelf cost。activateDeclaredAbility 後 B04031 は 'sleep' になる。
//   (COST-N)   rules/21: sleep 済 / stun の B04031 では sleepSelf cost を払えず canPay=false。
//   (0-pick)   「1枚まで」(rules/15) human decline (0-pick) → 誰も AP+1000 も 突撃 も得ない
//              ($picked 未束縛 → step2 が startsWith('$') guard で silent no-op)。
//   (scope:turn) ターン終了時まで — endTurn の clearTurnEffects('turn') で AP bonus と 突撃 が両方失効する。
//   (descriptor) abilities 構造 sanity (matchObject)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { endTurn } from '@/engine/flow/turn';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B04031 } from '@/cards/ct-p04/B04031';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B04031_ で id 衝突回避。abilities 無しで AP を制御) ----
const KAITO = 'DEC_B04031_KAITO';   // VALID 候補: names=['黒羽快斗'] (cardName filter 該当)
const NOTKAITO = 'DEC_B04031_NOT';  // DECOY:    names=['工藤新一'] (cardName filter 非該当)

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(KAITO, { names: ['黒羽快斗'], ap: 3000, level: 4 }));   // VALID
  registerCardDef(ch(NOTKAITO, { names: ['工藤新一'], ap: 3000, level: 4 })); // DECOY (cardName 違反)
}

// B04031 を active で現場に置く base。黒羽快斗(VALID) + 工藤新一(DECOY) を同居させる。
function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [
    sceneChar('B04031', 'aoko#1', { state: 'active' }),
    sceneChar(KAITO, 'kaito#1', { state: 'active' }),   // 黒羽快斗 → cardName filter 該当 (VALID)
    sceneChar(NOTKAITO, 'kudo#1', { state: 'active' }), // 工藤新一 → cardName filter 非該当 (DECOY)
  ];
  return s;
}

describe('B04031 中森青子 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _resetActionContexts();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ============================================================
  // A-filter + DECOY: 宣言能力で charModifyAP pick が surface — 候補は cardName[黒羽快斗] のみ
  // ============================================================
  it('a1 + DECOY: 宣言で charModifyAP pick が surface — 候補は 黒羽快斗 のみ (工藤新一 decoy 除外)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = base();

    expect(canDeclaredAbility(s, 'aoko#1', 'a1'), 'a1 宣言可 (存在 + limit/condition 無し)').toBe(true);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a1'); // cost: sleepSelf / effect:declared queue
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'charModifyAP pick が surface (= a1 effect step1)').toBe('charModifyAP');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張: cardName filter を engine が実評価 → 黒羽快斗 のみ候補。
    expect(candCardIds, '候補は 黒羽快斗 (KAITO) のみ').toEqual([KAITO]);
    expect(candCardIds, '工藤新一 decoy (NOTKAITO) は候補外 (cardName 違反)').not.toContain(NOTKAITO);
    expect(candCardIds, 'B04031 自身も 黒羽快斗 でないので候補外').not.toContain('B04031');
  });

  // ============================================================
  // A-pick: 黒羽快斗 を pick → step1 AP+1000 AND step2 突撃 付与 (pick-share が同一キャラへ両 atom)
  // ============================================================
  it('a1: 黒羽快斗 を pick → AP+1000 (3000→4000) かつ 突撃 を取得 / 工藤新一 decoy は AP不変・突撃なし', () => {
    setHuman('self');
    let s = base();
    expect(read.char.ap(s, 'kaito#1'), '黒羽快斗 初期 AP3000').toBe(3000);
    expect(read.char.hasKeyword(s, 'kaito#1', '突撃'), '初期は 突撃 を持たない').toBe(false);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a1');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const kaitoCand = pending.candidates.find((c) => c.cardId === KAITO)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, kaitoCand.uid);
    });

    // pick-share: 同一 picked キャラ (黒羽快斗) に step1(AP) と step2(突撃) の両方が適用される
    expect(read.char.ap(s, 'kaito#1'), 'step1: AP+1000 適用 (3000→4000)').toBe(4000);
    expect(read.char.hasKeyword(s, 'kaito#1', '突撃'), 'step2: 突撃 を取得 ($picked.uid bind reuse)').toBe(true);

    // DECOY: 工藤新一 は両 atom とも no-op (AP不変・突撃なし)
    expect(read.char.ap(s, 'kudo#1'), 'decoy 工藤新一 は AP 不変 (3000)').toBe(3000);
    expect(read.char.hasKeyword(s, 'kudo#1', '突撃'), 'decoy 工藤新一 は 突撃 を持たない').toBe(false);
    // cost も支払済み (sleepSelf, rules/21 cost-first)
    expect(s.players.self.scene.find((c) => c.uid === 'aoko#1')?.state, 'cost: B04031 自身スリープ').toBe('sleep');
  });

  // ============================================================
  // COST: 【スリープ】= sleepSelf cost を engine が払う → B04031 = 'sleep'
  // ============================================================
  it('COST: a1 使用後 B04031 は sleep になる (sleepSelf cost, rules/21)', () => {
    setHuman('self');
    let s = base();
    expect(s.players.self.scene.find((c) => c.uid === 'aoko#1')?.state, '使用前は active').toBe('active');

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a1');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'aoko#1')?.state, 'sleepSelf cost で B04031 は sleep').toBe('sleep');
  });

  // ============================================================
  // COST-N: rules/21 — sleep / stun の B04031 では sleepSelf cost を払えず canPay=false
  // ============================================================
  it('COST NEGATIVE: sleep 状態の B04031 では sleepSelf cost を払えず canPay=false', () => {
    const s = base();
    const a1 = B04031.abilities.find((a) => a.id === 'a1')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B04031', uid: 'aoko#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    // active なら払える (対比)
    expect(engineCost.canPay(s, a1.cost!, ctx), 'active の B04031 → sleepSelf cost 払える').toBe(true);
    // sleep だと払えない
    const sleeping = produce(s, (d) => { d.players.self.scene[0]!.state = 'sleep'; });
    expect(engineCost.canPay(sleeping, a1.cost!, ctx), 'sleep の B04031 → sleepSelf cost 不可').toBe(false);
    // stun でも払えない (sleep にできない)
    const stunned = produce(s, (d) => { d.players.self.scene[0]!.state = 'stun'; });
    expect(engineCost.canPay(stunned, a1.cost!, ctx), 'stun の B04031 → sleepSelf cost 不可').toBe(false);
  });

  // ============================================================
  // 0-pick: 「1枚まで」=0枚可 (rules/15) — human decline → 誰も AP+1000 も 突撃 も得ない
  // ============================================================
  it('NEGATIVE (0-pick): human decline → VALID候補が居ても AP/突撃 とも誰も得ない ($picked 未束縛で step2 no-op)', () => {
    setHuman('self');
    let s = base();

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a1');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'charModifyAP pick surface').toBe('charModifyAP');
    expect(pending.nMin, '0枚可').toBe(0);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」=0枚可, rules/15)
    });

    // decline: 黒羽快斗 (VALID) も AP+1000 / 突撃 を得ない
    expect(read.char.ap(s, 'kaito#1'), 'decline: 黒羽快斗 は AP 不変 (3000)').toBe(3000);
    expect(read.char.hasKeyword(s, 'kaito#1', '突撃'), 'decline: 黒羽快斗 は 突撃 を持たない (step2 silent no-op)').toBe(false);
    // 工藤新一 も当然不変
    expect(read.char.ap(s, 'kudo#1'), 'decline: 工藤新一 も AP 不変').toBe(3000);
    expect(read.char.hasKeyword(s, 'kudo#1', '突撃'), 'decline: 工藤新一 も 突撃 なし').toBe(false);
    // cost (sleepSelf) は rules/21 cost-first で支払済み
    expect(s.players.self.scene.find((c) => c.uid === 'aoko#1')?.state, 'cost: 0-pick でも sleepSelf は支払済').toBe('sleep');
  });

  // ============================================================
  // scope:'turn': ターン終了時まで — endTurn の clearTurnEffects('turn') で AP+1000 と 突撃 が両方失効
  // ============================================================
  it('scope:turn: 黒羽快斗 の AP+1000 と 突撃 は endTurn (clearTurnEffects) で両方失効する', () => {
    setHuman('self');
    let s = base();

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a1');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const kaitoCand = pending.candidates.find((c) => c.cardId === KAITO)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, kaitoCand.uid);
    });
    // 適用直後 (ターン中) は両方有効
    expect(read.char.ap(s, 'kaito#1'), 'ターン中: AP+1000 有効').toBe(4000);
    expect(read.char.hasKeyword(s, 'kaito#1', '突撃'), 'ターン中: 突撃 有効').toBe(true);

    // 自分ターンを終了 → clearTurnEffects('turn') が apMod_turn と grantedKeywords を削除
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(s, 'kaito#1'), 'ターン終了後: AP+1000 失効 (3000 に戻る)').toBe(3000);
    expect(read.char.hasKeyword(s, 'kaito#1', '突撃'), 'ターン終了後: 突撃 失効').toBe(false);
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1=declared, cost=sleepSelf, effect=sequence[charModifyAP{cardName:黒羽快斗,delta:1000,scope:turn,bind:$picked} → charGrantKeyword{$picked.uid,突撃,turn}]', () => {
    const a1 = B04031.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'sleepSelf' });
    const eff = a1.effect as { kind: string; steps: Array<{ kind: string; verb: string; args: Record<string, unknown> }> };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps).toHaveLength(2);
    // step1: charModifyAP 短縮形 carrier (uid 不在 = 短縮形 pick) + cardName filter + scope:turn + bind
    expect(eff.steps[0].verb).toBe('charModifyAP');
    expect(eff.steps[0].args).toMatchObject({
      max: 1, side: 'either', filter: { cardName: '黒羽快斗' }, delta: 1000, scope: 'turn', bind: '$picked',
    });
    expect(eff.steps[0].args.uid, '短縮形 pick = uid 明示なし (BUG-130 回避)').toBeUndefined();
    // step2: charGrantKeyword は同一 picked キャラ ($picked.uid) へ 突撃 を turn-scope 付与
    expect(eff.steps[1].verb).toBe('charGrantKeyword');
    expect(eff.steps[1].args).toMatchObject({ uid: '$picked.uid', kw: '突撃', scope: 'turn' });
  });
});
