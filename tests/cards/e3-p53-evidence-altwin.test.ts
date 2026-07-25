// engine E3 P53 (2026-07-03) — 犯人たちの犯行 (B09107) の 3 primitive:
//   ① evidenceFlip all-mode: 「自分の証拠をすべて表向きにする」(a.all===true で全証拠 faceUp 化)。
//   ② evidenceTraitAtLeast Condition: 「自分の証拠に〚特徴［犯人］〛のカードが8枚以上ある場合」。
//   ③ cannotSolveCase flag: 「自分は【事件解決】できない」(case 継続能力 → canWin/canSolveCase(UI/AI) gate)。
//   ※ alt-lose「相手はゲームに敗北する」verb は E3 増分1 (opponentLoses) で出荷済。
//
// engine-only、consumer B09107 は card phase (card 凍結中) → probe のみ。
// rules: 01(勝敗・事件解決) / 15・25(即時解決) / 17(継続能力) / 24(常時有効型) / 10(証拠表向き)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { atomEvidenceFlip } from '@/engine/effect/atom-handlers/core';
import { game } from '@/engine/read/game';
import { canSolveCase } from '@/ai/move-enumerator';
import { canSolveCaseForUi } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { isAllowed } from '@/ui/hooks/useEngineDispatch/can-check';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, Condition, EffectCtx, EvidenceCard, GameState } from '@/engine/types';

function ch(id: string, traits: string[] = []): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
function caseDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'case', names: [id], colors: ['黒'], level: 6, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });
const ctxOf = (p: 'self' | 'opp'): EffectCtx =>
  ({ source: { player: p, area: 'case', cardId: 'C' }, bindings: {} } as unknown as EffectCtx);
// 「自分は【事件解決】できない」case 継続能力
const cannotSolveAbility = (condition?: Condition) => ({
  id: 'a0', type: 'continuous' as const, condition,
  continuousModifier: { cannotSolveCase: true }, description: '事件解決不可',
});

beforeEach(() => {
  resetDefRegistry();
});

// ────────────────────────────────────────── ① evidenceFlip all-mode
describe('E3 P53 ① evidenceFlip all-mode', () => {
  it('self の全証拠を表向きにする (裏向き混在)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('A', false), ev('B', true), ev('C', false)];
    });
    const s1 = produce(s0, (d) => atomEvidenceFlip(d, { player: 'self', all: true }, ctxOf('self'), 'evidenceFlip'));
    expect(s1.players.self.evidence.every(e => e.faceUp)).toBe(true);
    expect(s1.players.self.evidence.map(e => e.cardId)).toEqual(['A', 'B', 'C']); // 順序不変
  });

  it('証拠 0 枚 → no-op (throw なし)', () => {
    const s0 = createEmptyGameState();
    expect(() => produce(s0, (d) => atomEvidenceFlip(d, { player: 'self', all: true }, ctxOf('self'), 'evidenceFlip'))).not.toThrow();
  });

  it('相手の証拠には触れない (player:self)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('A', false)];
      d.players.opp.evidence = [ev('X', false)];
    });
    const s1 = produce(s0, (d) => atomEvidenceFlip(d, { player: 'self', all: true }, ctxOf('self'), 'evidenceFlip'));
    expect(s1.players.self.evidence[0].faceUp).toBe(true);
    expect(s1.players.opp.evidence[0].faceUp).toBe(false);
  });
});

// ────────────────────────────────────────── ② evidenceTraitAtLeast
describe('E3 P53 ② evidenceTraitAtLeast Condition', () => {
  beforeEach(() => {
    registerCardDef(ch('HAN1', ['犯人']));
    registerCardDef(ch('HAN2', ['犯人']));
    registerCardDef(ch('OTHER', ['探偵']));
  });
  const withEv = (ids: string[]): GameState =>
    produce(createEmptyGameState(), (d) => { d.players.self.evidence = ids.map(id => ev(id)); });

  it('特徴[犯人] が n 枚以上 → true / 未満 → false', () => {
    const cond: Condition = { kind: 'evidenceTraitAtLeast', player: 'self', trait: '犯人', n: 2 };
    expect(evalCond(withEv(['HAN1', 'HAN2', 'OTHER']), cond, ctxOf('self'))).toBe(true);
    expect(evalCond(withEv(['HAN1', 'OTHER']), cond, ctxOf('self'))).toBe(false);
  });

  it('特徴[犯人]以外が混在しても犯人だけを計数 (B09107 Q&A)', () => {
    const cond: Condition = { kind: 'evidenceTraitAtLeast', player: 'self', trait: '犯人', n: 2 };
    expect(evalCond(withEv(['HAN1', 'HAN2', 'OTHER', 'OTHER']), cond, ctxOf('self'))).toBe(true);
  });

  it('trait 配列 (any-match)', () => {
    const cond: Condition = { kind: 'evidenceTraitAtLeast', player: 'self', trait: ['犯人', '探偵'], n: 3 };
    expect(evalCond(withEv(['HAN1', 'HAN2', 'OTHER']), cond, ctxOf('self'))).toBe(true);
  });

  it('player 解決 (opp の証拠を数える)', () => {
    const cond: Condition = { kind: 'evidenceTraitAtLeast', player: 'opp', trait: '犯人', n: 1 };
    const s = produce(createEmptyGameState(), (d) => { d.players.opp.evidence = [ev('HAN1')]; });
    expect(evalCond(s, cond, ctxOf('self'))).toBe(true);
  });
});

// ────────────────────────────────────────── ③ cannotSolveCase flag
describe('E3 P53 ③ cannotSolveCase gate', () => {
  // 通常勝利条件を満たした state
  const winnable = (caseId: string): GameState => produce(createEmptyGameState(), (d) => {
    const p = d.players.self;
    d.turn.player = 'self';
    d.turn.phase = 'main';
    p.case.cardId = caseId;
    p.case.status = '解決編';
    p.case.requiredEvidence = 2;
    p.evidence = [ev('A'), ev('B')];
    p.partner.state = 'active';
    p.partner.location = 'partner-area';
    p.partner.cardId = 'B01025';
    d.turnState.self.assistedThisTurn = false;
  });

  it('cannotSolveCase 無 → canWin true (baseline)', () => {
    registerCardDef(caseDef('CASE_OK'));
    expect(game.canWin(winnable('CASE_OK'), 'self')).toBe(true);
  });

  it('case 継続能力 cannotSolveCase → canWin false (勝利条件を満たしても)', () => {
    registerCardDef(caseDef('CASE_NO', { abilities: [cannotSolveAbility()] }));
    expect(game.canWin(winnable('CASE_NO'), 'self')).toBe(false);
  });

  it('cannotSolveCase helper 直: true/false', () => {
    registerCardDef(caseDef('CASE_NO', { abilities: [cannotSolveAbility()] }));
    registerCardDef(caseDef('CASE_OK'));
    expect(game.cannotSolveCase(winnable('CASE_NO'), 'self')).toBe(true);
    expect(game.cannotSolveCase(winnable('CASE_OK'), 'self')).toBe(false);
  });

  it('ability.condition false の override は無効 → canWin true', () => {
    registerCardDef(caseDef('CASE_COND', { abilities: [cannotSolveAbility({ kind: 'false' })] }));
    expect(game.canWin(winnable('CASE_COND'), 'self')).toBe(true);
  });

  it('AI canSolveCase / UI canSolveCaseForUi / dispatch isAllowed も cannotSolveCase を honor', () => {
    registerCardDef(caseDef('CASE_NO', { abilities: [cannotSolveAbility()] }));
    registerCardDef(caseDef('CASE_OK'));
    // AI enumerator
    expect(canSolveCase(winnable('CASE_NO'), 'self')).toBe(false);
    expect(canSolveCase(winnable('CASE_OK'), 'self')).toBe(true);
    // UI enumerator
    expect(canSolveCaseForUi(winnable('CASE_NO'), 'self')).toBe(false);
    expect(canSolveCaseForUi(winnable('CASE_OK'), 'self')).toBe(true);
    // dispatch 前段ガード (4th gate、defense-in-depth)
    expect(isAllowed(winnable('CASE_NO'), { type: 'solveCase', player: 'self' })).toBe(false);
    expect(isAllowed(winnable('CASE_OK'), { type: 'solveCase', player: 'self' })).toBe(true);
  });
});
