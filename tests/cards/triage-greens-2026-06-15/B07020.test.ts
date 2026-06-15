// gate5 RUNTIME behavior — B07020 綾小路文麿 (character, 緑/警察|京都府警, L7 AP5000 LP1)
//
// 公式テキスト:
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにあるレベル5以下の
//     〚カード名［マロちゃん］〛かレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
//
// rules: 15-abilities-effects.md (「〜まで」=0枚可) / 17-icons.md (条件アイコン) /
//        20-color-and-switch.md (効果による登場=色制限なし) /
//        21-declared-ability-cost.md (【宣言】コストはすべて行う / 一部でも不可なら使用不可 /
//          sleep コストは active キャラのみ払える / 名乗り・active 不問だが sleep/stun は sleep cost 不可) /
//        19-special-rules.md (split-name) / 03-field-areas.md (現場5枚上限・状態).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   activateDeclaredAbility('B07020', 'a1') → cost pay (sleepSelf + removeFromHand×1) +
//   useDeclaredAbility が effect:declared を queue → runAllUntilEmpty + drainAiEffectPicks
//   (sceneEnter from:remove Pattern B pick を AI/human 解決)。
//
// 検証する filter (BUG-117/118 lesson: DSL に filterAny を書いても engine が実評価する保証はない):
//   query.filterAny:[
//     {cardName:'マロちゃん', levelMax:5, kind:'character'},   // OR branch 1
//     {trait:'警察',        levelMax:5, kind:'character'},     // OR branch 2
//   ]
//   candidates.ts matchesFiltersByCardId → filterAny.some(matchOneFilter) を engine が実評価しているか。
//   各 filter object 内は AND (cardName/trait + levelMax + kind すべて満たす必要)。
//
// DECOY (filter が実評価されている証明 / 各 reject 軸を1つずつ崩す):
//   D_KEISATSU_L5  : 警察 L5 character          → branch2 該当 (= VALID 候補)。
//   D_MARO (B04025): cardName マロちゃん L2 シマリス → branch1 該当 (= VALID 候補。trait非警察でも cardName で通る)。
//   D_KEISATSU_L6  : 警察 L6 character          → levelMax5 超で **候補外** (level filter 実評価)。
//   D_KEISATSU_EV  : 警察 L5 *event*            → kind:character でないので **候補外** (kind filter 実評価)。
//   D_TANTEI_L5    : 探偵 L5 character (name≠マロ) → どちらの branch にも非該当で **候補外** (trait/cardName 実評価)。
//
// NEGATIVE:
//   N0 (0-pick / 「1枚まで」=0枚可, rules/15): human decline → 何も登場せず、VALID 候補は remove に残る。
//                                                cost (sleepSelf + hand 1 リムーブ) は支払済み (rules/21 cost-first)。
//   Ncost (rules/21 「すべて行えなければ不可」): sleep 状態の B07020 では sleepSelf cost 払えず canPay=false /
//                                                手札0枚では removeFromHand cost 払えず canPay=false。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B07020 } from '@/cards/ct-p07/B07020';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B07020_ で id 衝突回避) ----
const KEISATSU_L5 = 'DEC_B07020_KEISATSU_L5';  // VALID (branch2: 警察 L5 character)
const KEISATSU_L6 = 'DEC_B07020_KEISATSU_L6';  // DECOY (levelMax5 超)
const KEISATSU_EV = 'DEC_B07020_KEISATSU_EV';  // DECOY (kind:event)
const TANTEI_L5 = 'DEC_B07020_TANTEI_L5';      // DECOY (trait≠警察 / name≠マロちゃん)
const HANDFILLER = 'DEC_B07020_HANDFILLER';    // cost の removeFromHand 用 (任意の手札カード)
const MARO = 'B04025';                          // 実カード マロちゃん (シマリス L2) — branch1 VALID

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(ch(KEISATSU_L5, { traits: ['警察'], level: 5 }));
  registerCardDef(ch(KEISATSU_L6, { traits: ['警察'], level: 6 }));
  registerCardDef(ch(KEISATSU_EV, { kind: 'event', traits: ['警察'], level: 5 }));
  registerCardDef(ch(TANTEI_L5, { traits: ['探偵'], level: 5 }));
  registerCardDef(ch(HANDFILLER, { traits: [], level: 1 }));
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

// B07020 を active で現場に置き、cost 用の手札を1枚持つ base。
function base(removeIds: string[], handExtra: string[] = [HANDFILLER]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B07020', 'fumi#1', { state: 'active' })];
  s.players.self.hand = [...handExtra];
  s.players.self.remove = [...removeIds];
  return s;
}

describe('B07020 綾小路文麿 — gate5 runtime behavior', () => {
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

  // ============================================================
  // AI happy path (branch2: 警察 L5) + DECOY (level/kind/trait filter 実評価)
  // ============================================================
  it('AI: リムーブの 警察L5 を登場 / decoy(警察L6・警察event・探偵L5) は候補外で remove に残る', () => {
    let s = base([KEISATSU_L5, KEISATSU_L6, KEISATSU_EV, TANTEI_L5]);

    expect(canDeclaredAbility(s, 'fumi#1', 'a1'), 'a1 宣言可 (active + 候補存在)').toBe(true);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'fumi#1', 'a1'); // cost: sleepSelf + hand1リムーブ / effect queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // cost: 自身スリープ + 手札1枚リムーブ (rules/21 cost-first)
    expect(s.players.self.scene.find((c) => c.uid === 'fumi#1')?.state, 'cost: 自身スリープ').toBe('sleep');
    expect(inRemove(s, HANDFILLER), 'cost: 手札 HANDFILLER をリムーブ').toBe(true);

    // effect: 警察L5 (VALID) のみ登場
    expect(inScene(s, KEISATSU_L5), '警察L5 が現場へ登場').toBe(true);
    expect(inRemove(s, KEISATSU_L5), '登場した 警察L5 は remove から抜けた').toBe(false);

    // DECOY: filter 実評価の証明 — 各 decoy は候補外で remove に残る (登場しない)
    expect(inScene(s, KEISATSU_L6), 'DECOY 警察L6 (levelMax5超) は登場しない').toBe(false);
    expect(inRemove(s, KEISATSU_L6), '警察L6 は remove に残る').toBe(true);
    expect(inScene(s, KEISATSU_EV), 'DECOY 警察event (kind:character違反) は登場しない').toBe(false);
    expect(inRemove(s, KEISATSU_EV), '警察event は remove に残る').toBe(true);
    expect(inScene(s, TANTEI_L5), 'DECOY 探偵L5 (trait≠警察 / name≠マロ) は登場しない').toBe(false);
    expect(inRemove(s, TANTEI_L5), '探偵L5 は remove に残る').toBe(true);

    // 現場に登場したのは B07020 自身 + 警察L5 のちょうど2体
    expect(s.players.self.scene.length, '現場 = B07020 + 警察L5 の2体のみ').toBe(2);
  });

  // ============================================================
  // AI happy path (branch1: cardName マロちゃん) — trait非警察でも cardName で通る
  // ============================================================
  it('AI: branch1 — リムーブの マロちゃん(B04025 シマリスL2) を cardName で登場 / 探偵L5 decoy は候補外', () => {
    let s = base([MARO, TANTEI_L5]);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'fumi#1', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // マロちゃん は trait=シマリス (非警察) だが cardName branch1 で該当 → 登場
    expect(inScene(s, MARO), 'マロちゃん は cardName branch で登場 (trait非警察でも通る)').toBe(true);
    expect(inRemove(s, MARO), 'マロちゃん は remove から抜けた').toBe(false);
    // 探偵L5 は cardName≠マロ かつ trait≠警察 → 候補外
    expect(inScene(s, TANTEI_L5), '探偵L5 decoy は登場しない (両 branch 非該当)').toBe(false);
    expect(inRemove(s, TANTEI_L5), '探偵L5 は remove に残る').toBe(true);
  });

  // ============================================================
  // human pick + DECOY: 候補集合そのものを検証 (filterAny の正確な評価)
  // ============================================================
  it('human: pick 候補集合 = {警察L5, マロちゃん} のみ (decoy 全て除外) → 警察L5 を pick で登場', () => {
    setHuman('self');
    let s = base([KEISATSU_L5, KEISATSU_L6, KEISATSU_EV, TANTEI_L5, MARO]);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'fumi#1', 'a1');
      runAllUntilEmpty(d); // human 経路: sceneEnter pick を surface
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneEnter pick が surface').toBe('sceneEnter');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張: 候補は VALID 2枚 (警察L5 + マロちゃん) のみ。decoy 3枚は除外。
    expect(candCardIds, '候補は {警察L5, マロちゃん} のみ').toEqual([KEISATSU_L5, MARO].sort());
    expect(candCardIds, 'DECOY 警察L6 は候補外').not.toContain(KEISATSU_L6);
    expect(candCardIds, 'DECOY 警察event は候補外').not.toContain(KEISATSU_EV);
    expect(candCardIds, 'DECOY 探偵L5 は候補外').not.toContain(TANTEI_L5);

    // 警察L5 を pick (synthetic uid = cardId#index) → 登場
    const k5 = pending!.candidates.find((c) => c.cardId === KEISATSU_L5)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, k5.uid);
    });
    expect(inScene(s, KEISATSU_L5), 'pick した 警察L5 が登場').toBe(true);
    expect(inRemove(s, KEISATSU_L5), '警察L5 は remove から抜けた').toBe(false);
    // 未選択の VALID (マロちゃん) は remove に残る
    expect(inScene(s, MARO), '未選択の マロちゃん は登場しない').toBe(false);
    expect(inRemove(s, MARO), 'マロちゃん は remove に残る').toBe(true);
  });

  // ============================================================
  // NEGATIVE N0: 「1枚まで」=0枚可 — human decline → 何も登場しない (cost は支払済み)
  // ============================================================
  it('NEGATIVE (0-pick): human decline → VALID候補が居ても登場しない / cost (sleep + hand1) は支払済み', () => {
    setHuman('self');
    let s = base([KEISATSU_L5]);

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'fumi#1', 'a1');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」=0枚可, rules/15)
    });

    // decline: 何も登場しない、VALID 候補は remove に残る
    expect(inScene(s, KEISATSU_L5), 'decline: 警察L5 は登場しない').toBe(false);
    expect(inRemove(s, KEISATSU_L5), 'decline: 警察L5 は remove に残る').toBe(true);
    expect(s.players.self.scene.length, '現場は B07020 自身のみ (登場0)').toBe(1);
    // cost は rules/21 cost-first で支払済み
    expect(s.players.self.scene.find((c) => c.uid === 'fumi#1')?.state, 'cost: 自身スリープ済み').toBe('sleep');
    expect(inRemove(s, HANDFILLER), 'cost: 手札1枚リムーブ済み').toBe(true);
  });

  // ============================================================
  // NEGATIVE Ncost: rules/21 — cost を全部払えなければ宣言不可
  // ============================================================
  it('Ncost: sleep 状態の B07020 では sleepSelf cost 払えず canPay=false', () => {
    const s = base([KEISATSU_L5]);
    const sleeping = produce(s, (d) => { d.players.self.scene[0]!.state = 'sleep'; });
    const a1 = B07020.abilities.find((a) => a.id === 'a1')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B07020', uid: 'fumi#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    expect(engineCost.canPay(sleeping, a1.cost!, ctx), 'sleep の B07020 → sleepSelf cost 不可').toBe(false);
  });

  it('Ncost: 手札0枚では removeFromHand cost 払えず canPay=false', () => {
    const s = base([KEISATSU_L5], []); // 手札 0 枚
    const a1 = B07020.abilities.find((a) => a.id === 'a1')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B07020', uid: 'fumi#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    expect(engineCost.canPay(s, a1.cost!, ctx), '手札0枚 → removeFromHand cost 不可').toBe(false);
    // active + 手札1枚 なら payable (対比)
    const ok = base([KEISATSU_L5], [HANDFILLER]);
    expect(engineCost.canPay(ok, a1.cost!, ctx), 'active + 手札1枚 → cost 払える').toBe(true);
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1=declared, cost=pay[sleepSelf, removeFromHand×1], effect=sceneEnter{from:remove, filterAny[マロ|警察 × levelMax5 × character]}', () => {
    const a1 = B07020.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({
      kind: 'pay',
      items: [
        { kind: 'sleepSelf' },
        { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 } }, n: 1 },
      ],
    });
    expect(a1.effect).toMatchObject({
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        cardId: '$pick.cardId',
        viaEffect: true,
        target: {
          kind: 'pick',
          query: {
            area: 'remove',
            side: 'self',
            filterAny: [
              { cardName: 'マロちゃん', levelMax: 5, kind: 'character' },
              { trait: '警察', levelMax: 5, kind: 'character' },
            ],
          },
          n: { min: 0, max: 1 },
        },
      },
    });
  });
});
