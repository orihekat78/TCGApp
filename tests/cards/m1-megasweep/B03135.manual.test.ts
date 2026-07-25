// m1-megasweep probe — B03135 あばよ…名探偵!! (case, engine変更0)
//
// 印字 (ground truth, payloads/B03135.json fullTexts.effect):
//   自分の【黒】のパートナーの【事件解決】能力を以下の能力に書き換える。
//   【解決編】【証拠隠滅】【スリープ】〚証拠を事件レベルの数だけリムーブする〛：相手はゲームに敗北する。
// QA: 【黒】以外のパートナーをこの事件と一緒に使用可 → その場合は書き換えない (【事件解決】は通常のまま)。
//
// novel句 (全て engine 実評価で踏む):
//   a1: type:'continuous' / condition:{partnerColor 黒} / continuousModifier:{partnerSolveOverride:true}
//
// production dispatch:
//   - availability: game.canWin(state,p) — override は列挙を変えない (前提: 解決編/active partner/evidence>=required)
//   - execution:    partner.solveCase(state,p) — override 有効時、通常勝利 (reason:'evidence') の代わりに
//                   証拠を requiredEvidence(=事件レベル) 数リムーブ + alt-lose (winner:p, reason:'alt-lose') 決着。
//   - gate:         game.partnerSolveOverride(state,p) — case 継続能力 + ability.condition(partnerColor 黒) 走査。
// BUG-174: owner='opp' で反転しない (opp 黒 partner → 勝者 opp、self 側に副作用が出ない) を pin。
// beforeEach で registry 再登録 → resetDefRegistry で handler 累積回避 (本 card は listener 無、def registry のみ)。
// rules: 01 (勝敗・事件解決・一方通行) / 15・25 (即時解決「相手はゲームに敗北する」) / 17 (継続能力) /
//        20 (色) / 21 (【スリープ】cost)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { game } from '@/engine/read/game';
import { partner as partnerMutate } from '@/engine/mutate/partner';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, EvidenceCard, GameState } from '@/engine/types';
import { B03135 } from '@/cards/ct-p03/B03135';

function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], lp: 5 } as unknown as CardDef;
}
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'effect' } });

const PA_BLACK = 'PA_BLACK'; // 【黒】partner → 書き換え成立
const PA_RED = 'PA_RED';     // 非黒 partner → 書き換え不成立 (QA)

// 事件解決 winnable (解決編 + active partner + evidence>=required)。B03135 を自 case に置く。
function winnable(side: 'self' | 'opp', partnerId: string, evCount: number, required: number): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = side;
    d.turn.phase = 'main';
    const p = d.players[side];
    p.case.cardId = 'B03135';
    p.case.status = '解決編';
    p.case.requiredEvidence = required;
    p.evidence = Array.from({ length: evCount }, (_, i) => ev(`E${i}`));
    p.partner.cardId = partnerId;
    p.partner.state = 'active';
    p.partner.location = 'partner-area';
    d.turnState[side].assistedThisTurn = false;
  });
}

beforeEach(() => {
  resetDefRegistry();
  registerCardDef(B03135);
  registerCardDef(partnerDef(PA_BLACK, ['黒']));
  registerCardDef(partnerDef(PA_RED, ['赤']));
});

describe('B03135 — shape (印字 ⇔ DSL)', () => {
  it('case / 黒 / a1 = continuous partnerSolveOverride, condition partnerColor 黒', () => {
    expect(B03135.id).toBe('B03135');
    expect(B03135.no).toBe('0384/B03135');
    expect(B03135.kind).toBe('case');
    expect(B03135.colors).toEqual(['黒']);
    const a1 = B03135.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '黒' });
    expect(a1.continuousModifier?.partnerSolveOverride).toBe(true);
  });
});

describe('B03135 — partnerColor gate (game.partnerSolveOverride)', () => {
  it('【黒】partner → 書き換え成立 (true)', () => {
    expect(game.partnerSolveOverride(winnable('self', PA_BLACK, 2, 2), 'self')).toBe(true);
  });
  it('非黒 partner → 書き換え不成立 (false, QA「能力を書き換えない」)', () => {
    expect(game.partnerSolveOverride(winnable('self', PA_RED, 2, 2), 'self')).toBe(false);
  });
});

describe('B03135 — solveCase override execution (alt-lose + 証拠リムーブ)', () => {
  it('S1 happy: 黒 partner → 証拠を requiredEvidence 数リムーブ + reason alt-lose + partner sleep', () => {
    const s0 = winnable('self', PA_BLACK, 2, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(s1.players.self.evidence.length, '2 - 2 = 0').toBe(0);
    expect(s1.players.self.remove.length, 'リムーブへ 2 枚移動').toBe(2);
    expect(s1.players.self.partner.state, '【スリープ】cost').toBe('sleep');
  });

  it('S2 証拠過剰 (required=2, 所持3): ちょうど 2 リムーブ (1 残る)', () => {
    const s0 = winnable('self', PA_BLACK, 3, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(s1.players.self.evidence.length, '3 - 2 = 1').toBe(1);
    expect(s1.players.self.remove.length).toBe(2);
  });

  it('S3 off-variant 非黒 partner: 書き換え不成立 → 通常勝利 (reason evidence, 証拠不変)', () => {
    const s0 = winnable('self', PA_RED, 2, 2);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'self'));
    expect(s1.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    expect(s1.players.self.evidence.length, '通常勝利は証拠を消費しない').toBe(2);
    expect(s1.players.self.partner.state).toBe('sleep');
  });
});

describe('B03135 — canWin availability は override で不変', () => {
  it('黒 partner + winnable → canWin true (execution のみ差し替え、列挙不変)', () => {
    expect(game.canWin(winnable('self', PA_BLACK, 2, 2), 'self')).toBe(true);
  });
  it('証拠不足 (所持1 < required2) → canWin false (通常 gate と同一)', () => {
    expect(game.canWin(winnable('self', PA_BLACK, 1, 2), 'self')).toBe(false);
  });
});

describe('B03135 — owner=opp 対称 (BUG-174)', () => {
  it('opp の黒 partner → alt-lose winner opp / self 側に副作用なし', () => {
    const s0 = winnable('opp', PA_BLACK, 2, 2);
    expect(game.partnerSolveOverride(s0, 'opp')).toBe(true);
    const s1 = produce(s0, (d) => partnerMutate.solveCase(d, 'opp'));
    expect(s1.gameResult).toEqual({ winner: 'opp', reason: 'alt-lose' });
    expect(s1.players.opp.evidence.length, 'opp 証拠 2-2=0').toBe(0);
    expect(s1.players.opp.remove.length).toBe(2);
    expect(s1.players.self.evidence.length, 'self 側は無干渉').toBe(0);
    expect(s1.players.self.remove.length).toBe(0);
  });
});
