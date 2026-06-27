// card wave colornot-removeset-0627 — engine変更0 新カード 3枚 (printings: B07012/B07012P/B07048)。
// session60 解禁の colorNot filter (本堂瑛祐) + session59 解禁の removeSetCard cost (白馬探) を
// production で初投入。全 atom/cond/cost/filter は出荷済 engine の proven 機能のみ使用。
//
// 検証2層 (「画面処理 = カードテキスト文言」1対1):
//   A. 構造 1対1: 各 ability の DSL args (condition/hook/side/filter/level/cost/limit/optional/uid:$self/colorNot) が
//      公式テキストの語と 1対1 で一致 (条件外 filter 値・側・量指定子・cost kind の取り違えを固定)。
//   B. end-to-end (実 engine):
//      B1. colorNot hirameki filter (B07012 a2) を matchOneFilter で評価 — mono-青除外 / 2色{青,X}該当 (some説) /
//          非高校生除外 を decoy で 1対1 固定。
//      B2. sceneHas colorNot 条件 (B07012 a1) を evalCond で評価 — 自陣に青以外色のキャラ有/無で gate。
//      B3. removeSetCard cost (B07048 a2) を canPay で評価 — 裏向きセット合計 ≥2 で payable、表向き/不足で不可。
// rules: 10 (ヒラメキ), 15 (まで=0可/する=必須), 16 (セット), 17 (解決編/パートナー色/ターン1), 20 (色), 21 (宣言コスト)
// spec 根拠: .claude/specs/engine-additive-colornot-filter-design.md / engine-additive-removeset-cost-design.md
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { canPay } from '@/engine/cost/evaluate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { B07012 } from '@/cards/ct-p07/B07012';
import { B07012P } from '@/cards/ct-p07/B07012P';
import { B07048 } from '@/cards/ct-p07/B07048';
import type { AbilityDef, CardDef, GameState, Candidate, EffectDescriptor, EffectCtx, Condition, Cost, SetCardEntry } from '@/engine/types';

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
function ch(id: string, colors: string[], traits: string[] = [], kind: 'character' | 'event' = 'character'): CardDef {
  return { id, no: `9/${id}`, kind, names: [id], colors, level: 4, ap: 3000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

// decoy 群 (B1/B2 用)
const HS_BLUE = ch('HS_BLUE', ['青'], ['高校生']);          // mono-青・高校生 → colorNot:青 で除外
const HS_RED = ch('HS_RED', ['赤'], ['高校生']);            // 赤・高校生 → 該当
const HS_BR = ch('HS_BR', ['青', '赤'], ['高校生']);        // 2色{青,赤}・高校生 → some説で該当 (核心)
const DET_RED = ch('DET_RED', ['赤'], ['探偵']);           // 赤・探偵 (非高校生) → trait gate で除外

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [B07012, B07012P, B07048, HS_BLUE, HS_RED, HS_BR, DET_RED]) registerCardDef(d);
  s = createEmptyGameState();
});

// ───────────────────────── A. 構造 1対1 ─────────────────────────
describe('wave colornot-removeset-0627 — 構造 1対1 (DSL args = カードテキスト文言)', () => {
  it('B07012 本堂瑛祐: a1 解決編+登場時+自陣colorNot青→相手Lv4以下1枚までデッキ下 / a2 ヒラメキ remove青以外高校生→hand', () => {
    const a1 = ab(B07012, 'a1');
    expect(a1.type).toBe('triggered');
    // 【解決編】= caseStatus 解決編 / 【登場時】= enter selfOnly
    expect(a1.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    // 「自分の現場に【青】以外の色を持つキャラがいる場合」= effect conditional.if sceneHas{self, colorNot:青}, nMin1
    const eff = a1.effect as Record<string, unknown>;
    expect(eff.kind).toBe('conditional');
    expect(eff.if).toMatchObject({ kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { colorNot: '青' } }, nMin: 1 });
    // 「相手の現場にいるレベル4以下のキャラを1枚まで選び、デッキの下に移す」= sceneToDeck opp max1 levelMax4 (pos 既定bottom)
    const std = findArgs(a1.effect, 'sceneToDeck');
    expect(std).toMatchObject({ player: 'opp', max: 1, filter: { levelMax: 4 } });
    expect(std!.pos).toBeUndefined(); // 既定 'bottom' = デッキの下 (top 指定なし)
    // a2 ヒラメキ
    const a2 = ab(B07012, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(findArgs(a2.effect, 'handAddFromRemove')).toMatchObject({ player: 'self', max: 1, filter: { kind: 'character', colorNot: '青', trait: '高校生' } });
  });

  it('B07012P: base B07012 の絵柄違い (id/no/rarity/imageUrl のみ差分、abilities 共有)', () => {
    expect(B07012P.id).toBe('B07012P');
    expect(B07012P.no).toBe('0744/B07012P');
    expect(B07012P.rarity).toBe('CP');
    expect(B07012P.imageUrl).not.toBe(B07012.imageUrl);
    // 能力・基本値は完全一致 (spread)
    expect(B07012P.abilities).toBe(B07012.abilities);
    expect(B07012P.colors).toEqual(B07012.colors);
    expect(B07012P.level).toBe(B07012.level);
  });

  it('B07048 白馬探: a1 登場時→自デッキ上1枚を裏向きで自身にセット / a2 パートナー白+宣言+ターン1+removeSetCard2→draw1+discard1', () => {
    const a1 = ab(B07048, 'a1');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    // 「自分のデッキのカードを上から1枚裏向きでこのキャラにセット」= charSetCard uid:$self fromDeckTop self (faceUp 省略=裏向き)
    const set = findArgs(a1.effect, 'charSetCard');
    expect(set).toMatchObject({ uid: '$self', fromDeckTop: true, player: 'self' });
    expect(set!.faceUp).toBeUndefined();
    const a2 = ab(B07048, 'a2');
    expect(a2.type).toBe('declared');
    // 【パートナー白】= condition partnerColor 白 / 【ターン1】= limit turn1
    expect(a2.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    // コスト〚裏向きセット合わせて2枚リムーブ〛= removeSetCard n2
    expect(a2.cost).toMatchObject({ kind: 'removeSetCard', n: 2 });
    // 「カードを1枚引き、手札を1枚リムーブする」= sequence[draw self1, discard self1]
    expect((a2.effect as Record<string, unknown>).kind).toBe('sequence');
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    expect(findArgs(a2.effect, 'discard')).toMatchObject({ player: 'self', n: 1 });
  });
});

// ───────────────────────── B1. colorNot hirameki filter (実 engine) ─────────────────────────
describe('B07012 a2 hirameki: colorNot:青 + trait高校生 を実 engine (matchOneFilter) で評価', () => {
  function hiramekiFilter() {
    const a2 = ab(B07012, 'a2');
    return (findArgs(a2.effect, 'handAddFromRemove')!.filter) as Record<string, unknown>;
  }
  function mof(card: CardDef): boolean {
    const sc = sceneChar(card.id, `${card.id}#1`);
    return matchOneFilter(s, card.id, hiramekiFilter() as never, sc, { kind: 'char', uid: `${card.id}#1`, cardId: card.id, player: 'self' } as Candidate);
  }
  it('mono-青・高校生 は除外 (colorNot:青 some説 — 全色が青なら除外)', () => {
    expect(mof(HS_BLUE)).toBe(false);
  });
  it('赤・高校生 は該当', () => {
    expect(mof(HS_RED)).toBe(true);
  });
  it('2色{青,赤}・高校生 は該当 (some説の核 — 青以外の色=赤を持つ)', () => {
    expect(mof(HS_BR)).toBe(true);
  });
  it('赤・探偵 (非高校生) は除外 (trait gate)', () => {
    expect(mof(DET_RED)).toBe(false);
  });
});

// ───────────────────────── B2. sceneHas colorNot 条件 (実 engine) ─────────────────────────
describe('B07012 a1 条件: 自分の現場に【青】以外の色を持つキャラ (sceneHas colorNot) を evalCond で評価', () => {
  function sceneHasCond(): Condition {
    const eff = ab(B07012, 'a1').effect as Record<string, unknown>;
    return eff.if as Condition;
  }
  const ctx = { source: { player: 'self', area: 'scene', uid: 'HOST#1' }, bindings: {} } as unknown as EffectCtx;
  it('自陣に mono-青のみ → 条件不成立 (青以外の色なし)', () => {
    s.players.self.scene = [sceneChar('HS_BLUE', 'HS_BLUE#1')];
    expect(evalCond(s, sceneHasCond(), ctx)).toBe(false);
  });
  it('自陣に 赤キャラ → 条件成立', () => {
    s.players.self.scene = [sceneChar('HS_RED', 'HS_RED#1')];
    expect(evalCond(s, sceneHasCond(), ctx)).toBe(true);
  });
  it('自陣に 2色{青,赤} → 条件成立 (some説)', () => {
    s.players.self.scene = [sceneChar('HS_BR', 'HS_BR#1')];
    expect(evalCond(s, sceneHasCond(), ctx)).toBe(true);
  });
  it('相手陣の 赤キャラは自陣条件に数えない (side:self)', () => {
    s.players.self.scene = [sceneChar('HS_BLUE', 'HS_BLUE#1')];
    s.players.opp.scene = [sceneChar('HS_RED', 'HS_RED#1')];
    expect(evalCond(s, sceneHasCond(), ctx)).toBe(false);
  });
});

// ───────────── B2'. 【解決編】gate (a1.condition) を実 engine (evalCond) で評価 ─────────────
// review edge-lens concern: B2 は effect 内 sceneHas のみ検証し ability.condition(caseStatus) を素通り。
// caseStatus を落とす silent-overfire 回帰 (事件編でも発火) を固定する。
describe('B07012 a1 ability.condition: 【解決編】(caseStatus) を evalCond で gate', () => {
  function caseStatusCond(): Condition {
    return ab(B07012, 'a1').condition as Condition;
  }
  const ctx = { source: { player: 'self', area: 'scene', uid: 'HOST#1' }, bindings: {} } as unknown as EffectCtx;
  it('事件編 (初期) → 能力 gate off (発火しない)', () => {
    s.players.self.case.status = '事件編';
    expect(evalCond(s, caseStatusCond(), ctx)).toBe(false);
  });
  it('解決編 → 能力 gate on', () => {
    s.players.self.case.status = '解決編';
    expect(evalCond(s, caseStatusCond(), ctx)).toBe(true);
  });
});

// ───────────────────────── B3. removeSetCard cost (実 engine canPay) ─────────────────────────
describe('B07048 a2 cost: removeSetCard n2 を canPay で評価 (裏向きセット合計 ≥2)', () => {
  const cost = ab(B07048, 'a2').cost as Cost;
  const ctx = { source: { player: 'self', area: 'scene', uid: 'B07048#1' }, bindings: {} } as unknown as EffectCtx;
  function fd(n: number): SetCardEntry[] { return Array.from({ length: n }, (_, i) => ({ cardId: `set${i}`, faceUp: false })); }
  it('自陣1キャラに裏向きセット2枚 → payable', () => {
    s.players.self.scene = [sceneChar('B07048', 'B07048#1', { setCards: fd(2) })];
    expect(canPay(s, cost, ctx)).toBe(true);
  });
  it('裏向きセット1枚のみ → 不可 (n2 未満)', () => {
    s.players.self.scene = [sceneChar('B07048', 'B07048#1', { setCards: fd(1) })];
    expect(canPay(s, cost, ctx)).toBe(false);
  });
  it('表向きセット2枚 → 不可 (「裏向きで」ゆえ faceUp は数えない)', () => {
    s.players.self.scene = [sceneChar('B07048', 'B07048#1', { setCards: [{ cardId: 'a', faceUp: true }, { cardId: 'b', faceUp: true }] })];
    expect(canPay(s, cost, ctx)).toBe(false);
  });
  it('2キャラに1枚ずつ裏向き → payable (「合わせて」= 複数 host 跨ぎ)', () => {
    s.players.self.scene = [sceneChar('B07048', 'B07048#1', { setCards: fd(1) }), sceneChar('HS_RED', 'HS_RED#1', { setCards: fd(1) })];
    expect(canPay(s, cost, ctx)).toBe(true);
  });
});
