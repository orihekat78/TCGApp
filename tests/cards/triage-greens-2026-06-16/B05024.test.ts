// gate5 RUNTIME behavior — B05024 妃弁護士SOS (case, 青)
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：自分の現場にいるレベル5以上の
//     〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛（登場したターンから
//     すぐにキャラを指定してアクションできる）と〚ブレット〛（このキャラのアクションはガードできない）
//     を与える。
//
// rules:
//   01-victory-conditions.md (事件編→解決編 一方通行 / 解決編条件),
//   13-keywords.md (突撃[キャラ]=名乗りでも action[キャラ]可 / ブレット=ガード不可),
//   15-abilities-effects.md (「〜まで」=0枚可 / 効果解決順),
//   17-icons.md (【解決編】=条件アイコン / 【ターン1】=回数制限),
//   19-special-rules.md (カード名分割名 / cardName filter),
//   21-declared-ability-cost.md (【宣言】= cost 全部支払いで effect 解決).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   a1 = 共有 factory caseResolvedHandRemove({n:1})。case:to-resolved hook で発火し
//        自分の手札を1枚 discard する。matcher player==='self' (相手の事件解決では発火しない)。
//   a2 = 【解決編】【宣言】【ターン1】 cost flipFaceUpEvidence(3) → 短縮形 charGrantKeyword carrier
//        (filter {cardName:'毛利小五郎', levelMin:5}, side:'self', max:1, bind:'$picked') +
//        2 つ目の charGrantKeyword (uid:'$picked.uid') で同一 picked キャラに 突撃[キャラ]+ブレット を付与。
//
// decoy / negative (各 filter 1 つだけ破る decoy を置き、有効候補のみ選ばれることを実機で確認):
//   a2-NAMEDEC (cardName): L5 だが名前が「別キャラ」→ cardName filter を engine が honor すれば候補外。
//   a2-LVDEC  (levelMin): 名前は毛利小五郎だが L4 → levelMin:5 を honor すれば候補外。
//   a2-cond   (caseStatus): 事件編では canDeclaredAbility=false (【解決編】条件未達 → 能力を持たない扱い)。
//   a2-limit  (ターン1): 1回使用後 canDeclaredAbility=false。
//   a2-cost   (flipFaceUpEvidence exactly 3): 2枚指定では pay が throw (rules/21 コスト全部)。
//   a2-decline(「1枚まで」=0枚可, rules/15): human decline → どのキャラにも何も付与されない
//             (単一 optional pick、後続 mandatory step は無い ⇒ BUG-111 trap 該当せず)。
//   a1-NEG    (selfOnly): 相手 (opp) の事件が解決編になっても自分の a1 は発火しない (手札不変)。
//
// driver (verb を直接呼ばない):
//   a1: mutate.case.toResolved(d, side) → case:to-resolved emit → triggered listener → runAllUntilEmpty
//       → drainAiEffectPicks (AI が discard pick を解決)。
//   a2: pay(d, cost, ctx{dyn.costParams.flipFaceUpEvidence.indices}) → useDeclaredAbility(d, 'case:self', 'a2', ctx)
//       → runAllUntilEmpty。human 経路は pickQueue を覗いて候補集合を検証 + applyPick/applyPickSkip で解決。
//       AI 経路は drainAiEffectPicks で短縮形 carrier pick を解決し付与結果を盤面で検証。
//   ※ grounding 実測: 短縮形 carrier は useDeclaredAbility 内の同期 AI 解決では resolve されず
//      pending pick として surface する (B09032 と同挙動)。human=UI / AI=drainAiEffectPicks で解決する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { pay } from '@/engine/cost/pay';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B05024 } from '@/cards/ct-p05/B05024';
import type { AbilityDef, CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B05024_ / abilities:[] で再帰トリガー回避) ----
function charDef(id: string, names: string[], level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['青'],
    level, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const VALID = 'DEC_B05024_VALID';     // 毛利小五郎 / L5 → cardName + levelMin 両方合致 = 唯一の有効候補
const NAMEDEC = 'DEC_B05024_NAMEDEC'; // 別キャラ   / L5 → cardName filter decoy (名前のみ違反)
const LVDEC = 'DEC_B05024_LVDEC';     // 毛利小五郎 / L4 → levelMin filter decoy (level のみ違反)

function registerDecoys(): void {
  registerCardDef(charDef(VALID, ['毛利小五郎'], 5));
  registerCardDef(charDef(NAMEDEC, ['別キャラ'], 5));
  registerCardDef(charDef(LVDEC, ['毛利小五郎'], 4));
}

const a2cost = () => B05024.abilities[1].cost!;

// a2 base: 自分ターン / 自分の事件=B05024(解決編) / 現場に VALID+NAMEDEC+LVDEC / 裏向き証拠を evCount 枚。
function a2Base(evCount: number): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { cardId: 'B05024', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  s.players.self.scene = [
    sceneChar(VALID, 'v#1', { state: 'active' }),
    sceneChar(NAMEDEC, 'n#1', { state: 'active' }),
    sceneChar(LVDEC, 'l#1', { state: 'active' }),
  ];
  for (let i = 0; i < evCount; i++) {
    s.players.self.evidence.push({ cardId: `E${i}`, faceUp: false, origin: { turn: 1, via: 'reasoning' } });
  }
  return s;
}

// a2 を pay → useDeclaredAbility → runAllUntilEmpty で発動 (cost indices 指定)。
function fireA2(s: GameState, indices: number[]): GameState {
  return produce(s, (d) => {
    const ctx: EffectCtx = {
      source: { cardId: 'B05024', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
      bindings: {},
      dyn: { costParams: { flipFaceUpEvidence: { indices } } },
    };
    pay(d, a2cost(), ctx);
    useDeclaredAbility(d, 'case:self', 'a2', ctx);
    runAllUntilEmpty(d);
  });
}

describe('B05024 妃弁護士SOS — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ===== a1: case:to-resolved → 自分は手札を1枚リムーブ =====
  it('a1: 自分の事件が解決編になると 自分の手札を1枚 discard する', () => {
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.case = { cardId: 'B05024', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.opp.case = { cardId: 'OTHER', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
    s.players.self.hand = ['h1', 'h2'];
    s.players.opp.hand = ['oh1', 'oh2'];

    s = produce(s, (d) => {
      mutate.case.toResolved(d, 'self'); // 事件編→解決編 (一方通行 rules/01) → case:to-resolved emit
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: discard pick を解決
    });

    expect(s.players.self.case.status, '解決編へ移行').toBe('解決編');
    expect(s.players.self.hand.length, '自分の手札 2→1 (1枚 discard)').toBe(1);
    expect(s.players.opp.hand.length, '相手の手札は不変').toBe(2);
  });

  // ===== a1 NEGATIVE (selfOnly): 相手の事件解決では自分の a1 は発火しない =====
  it('a1 NEGATIVE: 相手 (opp) の事件が解決編になっても 自分の a1 は発火しない (matcher player==self)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.case = { cardId: 'B05024', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.opp.case = { cardId: 'OTHER', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
    s.players.self.hand = ['h1', 'h2'];
    s.players.opp.hand = ['oh1', 'oh2'];

    s = produce(s, (d) => {
      mutate.case.toResolved(d, 'opp'); // 相手の事件が解決編に
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.hand.length, '自分の手札は不変 (a1 非発火)').toBe(2);
    expect(s.players.opp.hand.length, '相手の手札も不変 (相手側に B05024 a1 は無い)').toBe(2);
  });

  // ===== a2 + DECOY (human): 候補は 毛利小五郎 & L5以上 のみ — cardName/levelMin decoy 除外 =====
  it('a2 + DECOY: 宣言能力で短縮形 charGrantKeyword pick が surface — 候補は VALID のみ (cardName decoy / levelMin decoy 除外)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = a2Base(3);

    s = fireA2(s, [0, 1, 2]);

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, '短縮形 charGrantKeyword pick が surface (= a2 発火 + cost 支払い済)').toBe('charGrantKeyword');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.nMax, '上限1枚').toBe(1);
    const candCardIds = pending!.candidates.map((c) => c.cardId);
    // DECOY 主張: cardName / levelMin を engine が実評価 → VALID のみ候補。
    expect(candCardIds, 'VALID (毛利小五郎/L5) は候補').toContain(VALID);
    expect(candCardIds, 'NAMEDEC (別キャラ/L5) は候補外 — cardName filter honor').not.toContain(NAMEDEC);
    expect(candCardIds, 'LVDEC (毛利小五郎/L4) は候補外 — levelMin:5 filter honor').not.toContain(LVDEC);
    expect(candCardIds.length, '有効候補は VALID 1 件のみ').toBe(1);
  });

  // ===== a2 (human pick): VALID を選択 → 突撃[キャラ]+ブレット 両方付与、decoy は不変 =====
  it('a2 (human pick): VALID を選択すると 突撃[キャラ]+ブレット を両方付与 (bind による 2 効果 1 体付与) / decoy は不変', () => {
    setHuman('self');
    let s = a2Base(3);
    s = fireA2(s, [0, 1, 2]);

    const pending = pickQueue()[0]!;
    const validCand = pending.candidates.find((c) => c.cardId === VALID)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, validCand.uid);
    });

    const vKws = read.char.keywords(s, 'v#1');
    expect(vKws, 'VALID に 突撃[キャラ] 付与 (action gate 用)').toContain('突撃[キャラ]');
    expect(vKws, 'VALID に ブレット 付与 (guard gate 用)').toContain('ブレット');
    expect(read.char.hasKeyword(s, 'v#1', '突撃[キャラ]'), 'hasKeyword 突撃[キャラ]').toBe(true);
    expect(read.char.hasKeyword(s, 'v#1', 'ブレット'), 'hasKeyword ブレット').toBe(true);
    // decoy は付与されない (pick されていない)
    expect(read.char.keywords(s, 'n#1'), 'NAMEDEC は付与なし').toHaveLength(0);
    expect(read.char.keywords(s, 'l#1'), 'LVDEC は付与なし').toHaveLength(0);
    // cost: 裏向き証拠3枚が表向きに
    expect(s.players.self.evidence.map((e) => e.faceUp), 'cost: 証拠3枚すべて表向き').toEqual([true, true, true]);
  });

  // ===== a2 (AI pick): drainAiEffectPicks で VALID に 突撃[キャラ]+ブレット 両方付与 =====
  it('a2 (AI pick): drainAiEffectPicks で短縮形 carrier が解決し VALID に 突撃[キャラ]+ブレット 両方付与', () => {
    setHuman(null); // CPU 経路
    let s = a2Base(3);
    s = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: 'B05024', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
        bindings: {},
        dyn: { costParams: { flipFaceUpEvidence: { indices: [0, 1, 2] } } },
      };
      pay(d, a2cost(), ctx);
      useDeclaredAbility(d, 'case:self', 'a2', ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(pickQueue().length, 'AI pick は drain 済').toBe(0);
    expect(read.char.hasKeyword(s, 'v#1', '突撃[キャラ]'), 'VALID 突撃[キャラ] (AI)').toBe(true);
    expect(read.char.hasKeyword(s, 'v#1', 'ブレット'), 'VALID ブレット (AI)').toBe(true);
    expect(read.char.keywords(s, 'n#1'), 'NAMEDEC は不変 (AI も decoy を選ばない)').toHaveLength(0);
    expect(read.char.keywords(s, 'l#1'), 'LVDEC は不変').toHaveLength(0);
  });

  // ===== a2 NEGATIVE (caseStatus 条件): 事件編では canDeclaredAbility=false =====
  it('a2 condition NEGATIVE: 事件編では canDeclaredAbility が false (【解決編】未達 → 能力を持たない扱い rules/17)', () => {
    let s = a2Base(3);
    s = produce(s, (d) => { d.players.self.case.status = '事件編'; });
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '事件編: a2 使用不可').toBe(false);
    // 解決編に戻すと使用可
    s = produce(s, (d) => { d.players.self.case.status = '解決編'; });
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '解決編: a2 使用可').toBe(true);
  });

  // ===== a2 NEGATIVE (ターン1): 1回使用後は canDeclaredAbility=false =====
  it('a2 NEGATIVE (ターン1): 1回使用後は canDeclaredAbility が false (再使用不可)', () => {
    let s = a2Base(6); // 2回分の証拠を用意するが【ターン1】で 2回目は不可になる
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '使用前: 可').toBe(true);
    s = fireA2(s, [0, 1, 2]);
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '1回使用後: 【ターン1】で再使用不可').toBe(false);
  });

  // ===== a2 cost (flipFaceUpEvidence exactly 3): 2枚指定では pay が throw =====
  it('a2 cost: 〚裏向きの証拠を3つ表向きにする〛は ちょうど3枚 — 2枚指定では pay が throw (rules/21 コスト全部)', () => {
    const s = a2Base(3);
    expect(() => fireA2(s, [0, 1]), '2枚指定 (min=max=3 違反) → pay throw').toThrow();
    // 証拠が3枚未満なら canPay 段階で発動不可 (facedown < 3)
    const s2 = a2Base(2);
    expect(() => fireA2(s2, [0, 1]), '証拠2枚では 3枚 flip 不能 → throw').toThrow();
  });

  // ===== a2 decline (「1枚まで」=0枚可): human decline → どのキャラにも付与されない =====
  it('a2 decline (0-pick): human が選択を辞退すると どのキャラにも 突撃[キャラ]/ブレット が付与されない (単一 optional pick、後続 mandatory 無し)', () => {
    setHuman('self');
    let s = a2Base(3);
    s = fireA2(s, [0, 1, 2]);

    const pending = pickQueue()[0]!;
    expect(pending.nMin, '「1枚まで」=0枚可').toBe(0);
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick 辞退
    });

    // テキストは「1枚まで選び…突撃[キャラ]とブレットを与える」= 単一 optional pick に対する付与。
    // 0枚選択なら付与対象が無く何も起こらない (後続に無条件 mandatory step は無い → BUG-111 trap 非該当)。
    expect(read.char.keywords(s, 'v#1'), 'decline: VALID にも付与されない').toHaveLength(0);
    expect(read.char.keywords(s, 'n#1'), 'decline: NAMEDEC 付与なし').toHaveLength(0);
    expect(read.char.keywords(s, 'l#1'), 'decline: LVDEC 付与なし').toHaveLength(0);
    // cost は支払い済 (rules/21: コストは effect 解決前に確定)
    expect(s.players.self.evidence.map((e) => e.faceUp), 'decline でも cost 証拠3枚は表向きのまま').toEqual([true, true, true]);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered case:to-resolved discard, a2=declared 解決編/turn1 flipFaceUpEvidence(3)→charGrantKeyword{毛利小五郎,L5,bind}+突撃[キャラ]/ブレット', () => {
    const [a1, a2] = B05024.abilities as [AbilityDef, AbilityDef];
    // a1: 共有 factory caseResolvedHandRemove
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.trigger, 'a1 case:to-resolved hook').toMatchObject({ hook: 'case:to-resolved' });
    expect(a1.scope, 'a1 scope always (case area)').toBe('always');
    // a2: declared
    expect(a2.type, 'a2 declared').toBe('declared');
    expect(a2.scope, 'a2 scope always (case area)').toBe('always');
    expect(a2.condition, 'a2 condition caseStatus 解決編').toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a2.limit, 'a2 【ターン1】').toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost, 'a2 cost flipFaceUpEvidence exactly 3').toMatchObject({ kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } });
    const steps = (a2.effect as { kind: string; steps: Array<Record<string, unknown>> });
    expect(steps.kind, 'a2 effect sequence').toBe('sequence');
    // step1: 短縮形 charGrantKeyword carrier (filter + bind:'$picked')
    expect(steps.steps[0], 'step1 charGrantKeyword 短縮形 carrier 突撃[キャラ]').toMatchObject({
      kind: 'atom',
      verb: 'charGrantKeyword',
      args: { player: 'self', max: 1, side: 'self', filter: { cardName: '毛利小五郎', levelMin: 5 }, kw: '突撃[キャラ]', scope: 'turn', bind: '$picked' },
    });
    // step2: 同一 picked キャラに ブレット 付与 (uid:'$picked.uid')
    expect(steps.steps[1], 'step2 charGrantKeyword $picked.uid ブレット').toMatchObject({
      kind: 'atom',
      verb: 'charGrantKeyword',
      args: { uid: '$picked.uid', kw: 'ブレット', scope: 'turn' },
    });
  });
});
