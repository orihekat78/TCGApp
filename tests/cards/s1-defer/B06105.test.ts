// s1-defer probe — B06105 ブラックインパクト！ (case)
//
// 公式テキスト:
//   a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：相手は手札を1枚リムーブする。
//       この効果によって相手がレベル6以下のカードをリムーブした場合、自分はカードを1枚引く。
//   a3: 自分の【黒】のパートナーの【事件解決】能力を書き換える (partnerSolveOverride、B05118 a2 同型)。
//
// novel 経路 (a2):
//   declared (uid='case:self') / cost {pay,[flipFaceUpEvidence n:3]} / condition caseStatus:解決編 / limit turn 1 /
//   effect sequence[ discard{player:'opp', n:1, bind:'$discarded'} (chooser 未指定 = 手札所有者 opp が選ぶ),
//     conditional{ if boundMatchesFilter{$discarded, levelMax:6} → draw{player:'self', n:1} } ]。
//   「レベル6以下のカードをリムーブした場合」= opp discard した cardId の印字 level ≤6 判定
//   (boundMatchesFilter cond/eval.ts levelMax honor)。opp 手札0 → bind 未書込 → 条件不成立 → draw なし。
//
// probe 観点: ① opp discard lvl6以下 → self draw / ② lvl7以上 → draw なし (decoy) / ③ owner=opp pin。
//   a3: partnerColor:黒 → override 有効 / 非黒 → 不成立 (B05118 test 同型)。
//
// rules: 15/25 (discard→conditional 逐次評価 B08048), 17 (【ターン1】【解決編】), 21 (cost flip 3),
//        01/13 (a3 事件解決書き換え・alt-lose)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { game } from '@/engine/read/game';
import { partner as partnerMutate } from '@/engine/mutate/partner';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B06105 } from '@/cards/ct-p06/B06105';
import type { CardDef, GameState, EffectCtx, EvidenceCard } from '@/engine/types';

// --- fixtures ---
const LVL6 = 'DEC_B06105_LVL6';  // level 6 → boundMatchesFilter levelMax:6 成立
const LVL7 = 'DEC_B06105_LVL7';  // level 7 → 不成立 (decoy)
const PA_BLACK = 'PA_BLACK';     // 黒 partner → a3 書き換え成立
const PA_RED = 'PA_RED';         // 非黒 → a3 不成立

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黒'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors, traits: [], keywords: [],
    rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], lp: 5 } as unknown as CardDef;
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const evd = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } });
const other = (p: 'self' | 'opp') => (p === 'self' ? 'opp' : 'self');

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerCardDef(B06105);
  registerCardDef(ch(LVL6, { level: 6 }));
  registerCardDef(ch(LVL7, { level: 7 }));
  registerCardDef(partnerDef(PA_BLACK, ['黒']));
  registerCardDef(partnerDef(PA_RED, ['赤']));
  for (const id of ['DK1', 'DK2', 'DK3']) registerCardDef(ch(id));
  registerTriggeredListener();
});

// ============================================================
// a2 — opp discard (相手が選ぶ) → conditional draw (lvl≤6)
// ============================================================
// owner=side の case:side を【解決編】+ 裏証拠3 (cost) + 相手(側)の手札 + owner deck (draw) でセット。
function base(opts: { side?: 'self' | 'opp'; status?: string; facedown?: number; targetHand?: string[] } = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const owner = s.players[side];
  owner.case.cardId = 'B06105';
  owner.case.status = (opts.status ?? '解決編') as GameState['players']['self']['case']['status'];
  owner.case.colors = ['黒'];
  owner.evidence = Array.from({ length: opts.facedown ?? 3 }, (_, i) => evd(`SE${i}`));
  owner.deck = ['DK1', 'DK2', 'DK3'];
  // 「相手」= owner の相手側。その手札が discard 対象。
  s.players[other(side)].hand = opts.targetHand ?? [LVL6];
  return s;
}

// discard は「相手が選ぶ」= 手札所有者 (owner の相手) の Pattern B pick。human 不在 (AI) では
// 初期 walk が先頭候補を自動採用 (substituteAtomPick heuristic)。対象手札を 1 枚に固定して決定化する。
describe('B06105 a2 — 相手は手札1枚リムーブ → レベル6以下なら自分は1ドロー', () => {
  it('① opp が レベル6 を discard → self は1ドロー (boundMatchesFilter levelMax:6 成立)', () => {
    const after = produce(base({ targetHand: [LVL6] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.hand.length, 'opp は手札1枚リムーブ').toBe(0);
    expect(after.players.opp.remove.includes(LVL6), 'LVL6 はリムーブへ').toBe(true);
    expect(after.players.self.hand.length, 'lvl6以下 → self 1ドロー').toBe(1);
    expect(after.players.self.evidence.slice(0, 3).every((e) => e.faceUp), 'cost で証拠3つ表向き').toBe(true);
  });

  it('② opp が レベル7 を discard → self は引かない (decoy, lvl7>6)', () => {
    const after = produce(base({ targetHand: [LVL7] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.hand.length, 'opp は手札1枚リムーブ').toBe(0);
    expect(after.players.opp.remove.includes(LVL7), 'LVL7 はリムーブへ').toBe(true);
    expect(after.players.self.hand.length, 'lvl7 → draw なし').toBe(0);
  });

  it('opp 手札0 → discard なし → 条件不成立 → draw なし (「リムーブした場合」)', () => {
    const after = produce(base({ targetHand: [] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'discard 不能 → draw なし').toBe(0);
  });

  it('【ターン1】: 宣言後 canDeclaredAbility=false', () => {
    const after = produce(base({ targetHand: [LVL6] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
    });
    expect(canDeclaredAbility(after, 'case:self', 'a2'), '同ターン2回目は宣言不可').toBe(false);
  });

  it('③ owner=opp pin (case:opp): discard は self(=opp の相手) を打ち、draw は opp が受ける', () => {
    const after = produce(base({ side: 'opp', targetHand: [LVL6] }), (d) => {
      activateDeclaredAbility(d, 'case:opp', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'self が手札リムーブ').toBe(0);
    expect(after.players.self.remove.includes(LVL6), 'self の LVL6 リムーブへ').toBe(true);
    expect(after.players.opp.hand.length, 'lvl6以下 → 事件所有者 opp が1ドロー').toBe(1);
    expect(after.players.opp.evidence.slice(0, 3).every((e) => e.faceUp), 'opp の証拠3つ表向き').toBe(true);
  });
});

// ============================================================
// a2 gate — condition / cost
// ============================================================
describe('B06105 a2 — condition / cost gate', () => {
  it('解決編 → 宣言可 / 事件編 → 不可', () => {
    expect(canDeclaredAbility(base({ status: '解決編' }), 'case:self', 'a2')).toBe(true);
    expect(canDeclaredAbility(base({ status: '事件編' }), 'case:self', 'a2')).toBe(false);
  });
  it('裏証拠2つ → canPay=false / 3つ → true (rules/21)', () => {
    const a2 = B06105.abilities.find((a) => a.id === 'a2')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B06105', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
      bindings: {},
    };
    expect(engineCost.canPay(base({ facedown: 2 }), a2.cost!, ctx)).toBe(false);
    expect(engineCost.canPay(base({ facedown: 3 }), a2.cost!, ctx)).toBe(true);
  });
});

// ============================================================
// a3 — partnerSolveOverride{partnerColor:黒} (B05118 a2 同型 clone)
// ============================================================
function winnable(p: 'self' | 'opp', partnerId: string, evCount: number, required: number): GameState {
  return produce(createEmptyGameState(), (d) => {
    const pl = d.players[p];
    pl.case.cardId = 'B06105';
    pl.case.status = '解決編';
    pl.case.requiredEvidence = required;
    pl.evidence = Array.from({ length: evCount }, (_, i) => evd(`E${i}`));
    pl.partner.cardId = partnerId;
    pl.partner.state = 'active';
    pl.partner.location = 'partner-area';
    d.turnState[p].assistedThisTurn = false;
  });
}

describe('B06105 a3 — partnerSolveOverride{partnerColor黒}: 【事件解決】alt-lose 書き換え', () => {
  it('partner 黒 → override 有効 → solveCase で証拠 required 数リムーブ + alt-lose', () => {
    const s0 = winnable('self', PA_BLACK, 3, 2);
    expect(game.partnerSolveOverride(s0, 'self'), 'B06105 a3 + partner 黒 → true').toBe(true);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult, '相手はゲームに敗北 = winner self / alt-lose').toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(s1.players.self.evidence.length, '3 - 2 = 1 残る').toBe(1);
    expect(s1.players.self.partner.state, '【スリープ】cost → partner sleep').toBe('sleep');
  });

  it('off-variant: partner 非黒 → override 不成立 → 通常 evidence 勝利', () => {
    const s0 = winnable('self', PA_RED, 2, 2);
    expect(game.partnerSolveOverride(s0, 'self'), 'partner 赤 → false').toBe(false);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult, '書き換えなし → 通常勝利').toEqual({ winner: 'self', reason: 'evidence' });
  });

  it('owner=opp pin: opp の B06105 + partner 黒 → opp 側で override 有効・self は不発火', () => {
    const s0 = winnable('opp', PA_BLACK, 2, 2);
    expect(game.partnerSolveOverride(s0, 'opp'), 'opp 側で対称').toBe(true);
    expect(game.partnerSolveOverride(s0, 'self'), 'self は B06105 事件なし → false').toBe(false);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'opp'));
    expect(s1.gameResult, 'winner = opp / alt-lose').toEqual({ winner: 'opp', reason: 'alt-lose' });
  });
});
