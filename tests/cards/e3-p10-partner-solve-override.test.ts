// engine E3 P10 (2026-07-03) — パートナー【事件解決】書き換え (B03135/B05118/B06105):
//   「自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。
//    【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。」
//
//   実装 = case 継続能力 continuousModifier.partnerSolveOverride (partnerColor 黒 gate は ability.condition)。
//   read.game.partnerSolveOverride が cannotSolveCase と同流儀で走査。override 有効時、mutate.partner.solveCase は
//   通常勝利 (reason:'evidence') の代わりに 証拠を requiredEvidence(=事件レベル) 数リムーブ + alt-lose 決着。
//   canWin/AI/UI の**列挙は不変** (override は availability を変えず execution のみ差し替え。前提条件は同一 —
//   【スリープ】cost=active partner、cost「証拠リムーブ」は evidence>=required を要求 → 通常 solve と同 gate)。
//   【証拠隠滅】keyword は display-only (参照 consumer 0) → engine repr なし。
//
//   engine-only、consumer B03135/B05118/B06105 は card phase (card 凍結中) → probe のみ。
// rules: 01(勝敗・事件解決・一方通行) / 15・25(即時解決「相手はゲームに敗北する」) / 21(cost) / 17(継続能力) / 20(色).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { game } from '@/engine/read/game';
import { partner as partnerMutate } from '@/engine/mutate/partner';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, Condition, EvidenceCard, GameState } from '@/engine/types';

function caseDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'case', names: [id], colors: ['黒'], level: 6, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], lp: 5 };
}
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'effect' } });

// 「自分の【黒】のパートナーの【事件解決】を書き換える」case 継続能力
const overrideAbility = (condition?: Condition) => ({
  id: 'a0', type: 'continuous' as const,
  condition: condition ?? ({ kind: 'partnerColor', color: '黒' } as Condition),
  continuousModifier: { partnerSolveOverride: true }, description: '事件解決書き換え',
});

beforeEach(() => {
  resetDefRegistry();
});

// winnable かつ partner 色を指定した state
const winnable = (caseId: string, partnerId: string, evCount = 2, required = 2): GameState =>
  produce(createEmptyGameState(), (d) => {
    d.turn.player = 'self';
    d.turn.phase = 'main';
    const p = d.players.self;
    p.case.cardId = caseId;
    p.case.status = '解決編';
    p.case.requiredEvidence = required;
    p.evidence = Array.from({ length: evCount }, (_, i) => ev(`E${i}`));
    p.partner.cardId = partnerId;
    p.partner.state = 'active';
    p.partner.location = 'partner-area';
    d.turnState.self.assistedThisTurn = false;
  });

describe('E3 P10 ① partnerSolveOverride helper (case 継続能力 + partnerColor gate)', () => {
  it('override ability + partner 黒 → true', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    expect(game.partnerSolveOverride(winnable('CASE_OV', 'PA_BLACK'), 'self')).toBe(true);
  });

  it('override ability + partner 赤 (非黒) → false (書き換え不成立、公式Q&A)', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_RED', ['赤']));
    expect(game.partnerSolveOverride(winnable('CASE_OV', 'PA_RED'), 'self')).toBe(false);
  });

  it('override ability 無 → false (baseline)', () => {
    registerCardDef(caseDef('CASE_PLAIN'));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    expect(game.partnerSolveOverride(winnable('CASE_PLAIN', 'PA_BLACK'), 'self')).toBe(false);
  });

  it('ability.condition false → false', () => {
    registerCardDef(caseDef('CASE_F', { abilities: [overrideAbility({ kind: 'false' })] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    expect(game.partnerSolveOverride(winnable('CASE_F', 'PA_BLACK'), 'self')).toBe(false);
  });
});

describe('E3 P10 ② solveCase override execution (alt-lose + 証拠リムーブ)', () => {
  it('override 有効 → 証拠を requiredEvidence 数リムーブ + reason alt-lose + partner sleep', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    const s0 = winnable('CASE_OV', 'PA_BLACK', 2, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(s1.players.self.evidence.length).toBe(0); // 2 - 2 = 0
    expect(s1.players.self.remove.length).toBe(2);   // リムーブへ移動
    expect(s1.players.self.partner.state).toBe('sleep');
  });

  it('override + 証拠過剰 (required=2, 所持3) → ちょうど 2 リムーブ (1 残る)', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    const s0 = winnable('CASE_OV', 'PA_BLACK', 3, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.players.self.evidence.length).toBe(1);
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
  });

  it('override 無 (通常) → reason evidence + 証拠不変 + partner sleep', () => {
    registerCardDef(caseDef('CASE_PLAIN'));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    const s0 = winnable('CASE_PLAIN', 'PA_BLACK', 2, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(s1.players.self.evidence.length).toBe(2); // 不変
    expect(s1.players.self.partner.state).toBe('sleep');
  });

  it('override + partner 非黒 → 通常勝利 (reason evidence、書き換え不成立)', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_RED', ['赤']));
    const s0 = winnable('CASE_OV', 'PA_RED', 2, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(s1.players.self.evidence.length).toBe(2);
  });
});

describe('E3 P10 ③ canWin availability は override で不変 (列挙は通常 solve と同一)', () => {
  it('override 有効でも winnable なら canWin true (execution のみ差し替え)', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    expect(game.canWin(winnable('CASE_OV', 'PA_BLACK', 2, 2), 'self')).toBe(true);
  });

  it('証拠不足 (cost 払えない) → canWin false (通常 gate と同)', () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    expect(game.canWin(winnable('CASE_OV', 'PA_BLACK', 1, 2), 'self')).toBe(false);
  });
});

describe('E3 P10 ④ opp 側 parameterization (self/opp 対称)', () => {
  it("p='opp' でも override 走査 + solveCase 分岐が対称に動く", () => {
    registerCardDef(caseDef('CASE_OV', { abilities: [overrideAbility()] }));
    registerCardDef(partnerDef('PA_BLACK', ['黒']));
    const s0 = produce(createEmptyGameState(), (d) => {
      const p = d.players.opp;
      p.case.cardId = 'CASE_OV';
      p.case.status = '解決編';
      p.case.requiredEvidence = 2;
      p.evidence = [ev('E0'), ev('E1')];
      p.partner.cardId = 'PA_BLACK';
      p.partner.state = 'active';
      p.partner.location = 'partner-area';
      d.turnState.opp.assistedThisTurn = false;
    });
    expect(game.partnerSolveOverride(s0, 'opp')).toBe(true);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'opp'));
    expect(s1.gameResult).toEqual({ winner: 'opp', reason: 'alt-lose' });
    expect(s1.players.opp.evidence.length).toBe(0);
  });
});
