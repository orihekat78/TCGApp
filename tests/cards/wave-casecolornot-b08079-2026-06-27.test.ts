// card wave casecolornot-b08079-2026-06-27 — engine変更0。session62 解禁の Condition.caseColorNot を
// production 初投入。B08079/B08079P ピンガ a3 (これまで DEFERRED だった宣言能力) を完成させる。
// 全 atom/cond/cost/filter は出荷済 engine の proven 機能のみ:
//   declared+condition+cost の複合 = B07048 a2 (session61) / declared+sleepSelf+sceneRemove = PR274 a2 /
//   apMax target filter = 62 printings (BUG-117 で silent-drop 修正済) / caseColorNot = session62 engine。
//
// 公式テキスト (a3): 【宣言】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。
//   この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる。
//   (a1 = 【自分ターン中】AP＋1000 / a2 = 【相手ターン中】【現場リムーブ時】draw1+discard1 は既出荷・不変)
//
// 検証2層 (「画面処理 = カードテキスト文言」1対1):
//   A. 構造 1対1: a3 の DSL args が公式語と 1対1 (declared / caseColorNot:黒 / sleepSelf / apMax:8000 / max1 / either / effect)。
//      a1/a2 不変 + B08079P.a3 = B08079.a3 (絵柄違いの同型) を固定。
//   B. end-to-end (実 engine):
//      B1. 宣言ゲート caseColorNot:黒 を evalCond で評価 — mono-黒除外(宣言不可)/2色{黒,X}該当(some説)/mono-X該当/空除外。
//      B2. apMax:8000 を matchOneFilter で評価 — AP7000該当/AP8000該当(境界含む)/AP9000除外/
//          effective-AP (base9000を-2000で7000) 該当 + (base7000を+2000で9000) 除外 (BUG-117 原則)。
//      B3. cost sleepSelf を canPay — active 自身 payable / sleep 済 不可。
// rules: 15 (まで=0可), 17 (条件アイコン=宣言ゲート), 19 (元色), 20 (色 some説), 21 (宣言コスト), 22 (cause:effect)
// spec 根拠: .claude/specs/engine-additive-casecolornot-design.md / engine-additive-colornot-filter-design.md
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { canPay } from '@/engine/cost/evaluate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B08079 } from '@/cards/ct-p08/B08079';
import { B08079P } from '@/cards/ct-p08/B08079P';
import type { AbilityDef, CardDef, GameState, Candidate, EffectDescriptor, Condition, Cost, TargetFilter, EffectCtx } from '@/engine/types';

function ab(card: CardDef, id: string): AbilityDef {
  return card.abilities.find((a) => a.id === id)! as AbilityDef;
}
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const st of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(st, verb);
    if (r) return r;
  }
  return null;
}
function ch(id: string, colors: string[], ap: number, traits: string[] = ['黒ずくめの組織']): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 4, ap, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

// apMax decoy 群 (B2 用) — 全 [赤] (色 gate なし、AP のみで分岐させる)
const AP7000 = ch('AP7000', ['赤'], 7000);             // 7000 ≤ 8000 → 該当
const AP8000 = ch('AP8000', ['赤'], 8000);             // 8000 ≤ 8000 → 該当 (境界含む)
const AP9000 = ch('AP9000', ['赤'], 9000);             // 9000 > 8000 → 除外
const AP9000DEBUFF = ch('AP9000DEBUFF', ['赤'], 9000); // base9000、turnEffect -2000 で effective7000 → 該当

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [B08079, B08079P, AP7000, AP8000, AP9000, AP9000DEBUFF]) registerCardDef(d);
  s = createEmptyGameState();
});

// ───────────────────────── A. 構造 1対1 ─────────────────────────
describe('B08079 ピンガ a3 — 構造 1対1 (DSL args = カードテキスト文言)', () => {
  it('a3: 宣言+スリープコスト+caseColorNot黒ゲート+AP8000以下1枚までリムーブ', () => {
    const a3 = ab(B08079, 'a3');
    expect(a3.type).toBe('declared');
    // 「この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる」= condition caseColorNot:黒 (宣言ゲート, rules/17)
    expect(a3.condition).toMatchObject({ kind: 'caseColorNot', color: '黒' });
    // 【スリープ】= cost sleepSelf
    expect(a3.cost).toMatchObject({ kind: 'sleepSelf' });
    // 「AP8000以下のキャラを1枚まで選び、リムーブする」= sceneRemove either max1 apMax8000 cause:effect
    const rm = findArgs(a3.effect, 'sceneRemove');
    expect(rm).toMatchObject({ player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } });
    // 取り違え固定: level/AP下限/枚数固定値ではないこと
    expect((rm!.filter as TargetFilter).levelMax).toBeUndefined();
    expect((rm!.filter as TargetFilter).apMin).toBeUndefined();
    expect(rm!.n).toBeUndefined(); // 「1枚まで」= max:1 (0可)、固定 n ではない
  });
  it('a1/a2 は不変 (継続AP+1000 / 相手ターン現場リムーブ時 draw+discard)', () => {
    const a1 = ab(B08079, 'a1');
    expect(a1.type).toBe('continuous');
    expect(a1.continuousModifier).toMatchObject({ apDelta: 1000 });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    const a2 = ab(B08079, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    expect(findArgs(a2.effect, 'discard')).toMatchObject({ player: 'self', n: 1 });
  });
  it('B08079P: base と同型 (id/no/rarity/imageUrl のみ差分、a3 含む全能力一致)', () => {
    expect(B08079P.id).toBe('B08079P');
    expect(B08079P.rarity).toBe('SRP');
    expect(B08079P.imageUrl).not.toBe(B08079.imageUrl);
    // a4 = 【変装】【事件黒】【FILE7】 (BUG-163 で henso 列 grounding 漏れを追補、2026-07-02)
    expect(B08079P.abilities.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
    // a3/a4 deep-equal (絵柄違いで text 同一)
    expect(ab(B08079P, 'a3')).toEqual(ab(B08079, 'a3'));
    expect(ab(B08079P, 'a4')).toEqual(ab(B08079, 'a4'));
    expect(B08079P.colors).toEqual(B08079.colors);
    expect(B08079P.ap).toBe(B08079.ap);
    expect(B08079P.traits).toEqual(B08079.traits);
  });
});

// ───────────────────────── B1. 宣言ゲート caseColorNot:黒 (実 engine evalCond) ─────────────────────────
describe('B08079 a3 宣言ゲート: 自分の事件が【黒】以外の色を持つ場合 (caseColorNot:黒) を evalCond で評価', () => {
  function gate(): Condition {
    return ab(B08079, 'a3').condition as Condition;
  }
  function ev(colors: string[]): boolean {
    s.players.self.case.colors = colors;
    s.players.self.case.cardId = '';
    return evalCond(s, gate(), makeCtx());
  }
  it('mono-黒事件 → 宣言不可 (黒以外の色なし、some説 false)', () => {
    expect(ev(['黒'])).toBe(false);
  });
  it('2色{黒,赤}事件 → 宣言可 (公式 qa 裏切りの街角 — 赤を持つ some説)', () => {
    expect(ev(['黒', '赤'])).toBe(true);
  });
  it('mono-赤事件 → 宣言可 (赤∉{黒})', () => {
    expect(ev(['赤'])).toBe(true);
  });
  it('空事件色 → 宣言不可 (「黒以外の色」が存在しない)', () => {
    expect(ev([])).toBe(false);
  });
});

// ───────────────────────── B2. apMax:8000 target filter (実 engine matchOneFilter) ─────────────────────────
describe('B08079 a3 対象: AP8000以下 (apMax:8000) を matchOneFilter で評価', () => {
  function apFilter(): TargetFilter {
    return findArgs(ab(B08079, 'a3').effect, 'sceneRemove')!.filter as TargetFilter;
  }
  function mof(card: CardDef, over: Partial<import('@/engine/types').SceneCharacter> = {}): boolean {
    const sc = sceneChar(card.id, `${card.id}#1`, over);
    return matchOneFilter(s, card.id, apFilter(), sc, { kind: 'char', uid: `${card.id}#1`, cardId: card.id, player: 'opp' } as Candidate);
  }
  it('AP7000 は該当 (7000 ≤ 8000)', () => {
    expect(mof(AP7000)).toBe(true);
  });
  it('AP8000 は該当 (境界含む — 「以下」)', () => {
    expect(mof(AP8000)).toBe(true);
  });
  it('AP9000 は除外 (9000 > 8000)', () => {
    expect(mof(AP9000)).toBe(false);
  });
  it('base9000 を -2000 debuff → effective7000 は該当 (effective-AP判定、BUG-117原則)', () => {
    expect(mof(AP9000DEBUFF, { turnEffects: { apMod_turn: -2000 } })).toBe(true);
  });
  it('base7000 を +2000 buff → effective9000 は除外 (effective-AP判定)', () => {
    expect(mof(AP7000, { turnEffects: { apMod_turn: 2000 } })).toBe(false);
  });
});

// ───────────────────────── B3. cost sleepSelf (実 engine canPay) ─────────────────────────
describe('B08079 a3 コスト: sleepSelf を canPay で評価', () => {
  const cost = ab(B08079, 'a3').cost as Cost;
  const ctx = { source: { player: 'self', area: 'scene', uid: 'B08079#1' }, bindings: {} } as unknown as EffectCtx;
  it('アクティブ自身 → payable', () => {
    s.players.self.scene = [sceneChar('B08079', 'B08079#1', { state: 'active' })];
    expect(canPay(s, cost, ctx)).toBe(true);
  });
  it('スリープ済自身 → 不可 (既にスリープ、状態変化なし=コスト不成立)', () => {
    s.players.self.scene = [sceneChar('B08079', 'B08079#1', { state: 'sleep' })];
    expect(canPay(s, cost, ctx)).toBe(false);
  });
  it('スタン状態自身 → 不可 (rules/03 スタンはスリープ化コスト不可、active 限定)', () => {
    s.players.self.scene = [sceneChar('B08079', 'B08079#1', { state: 'stun' })];
    expect(canPay(s, cost, ctx)).toBe(false);
  });
});
