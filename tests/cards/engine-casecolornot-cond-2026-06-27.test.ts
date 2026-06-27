// engine additive — Condition.caseColorNot (「自分の事件が【X】以外の色を持つ場合」, 2026-06-27 session62)。
// session60 TargetFilter.colorNot の Condition 版。caseColor の some説 negation。
//
// semantics (公式 B08079 裁定で確定 — some説):
//   「事件が【X】以外の色を持つ」= X以外の色を1つ以上持つ (caseColors.some(c => c∉notSet))。
//   mono-X → false / 2色{X,Y} → true (Y を持つ、公式裁定) / mono-Y → true / 空 → false。
//   等価: 全事件色が notSet 内のとき false。⚠ not(caseColor) (none説) とは 2色で非対称。
//
// 検証:
//   §1 fallback colors path (case.cardId='' → caseInfo.colors)
//   §2 lookupCardDef primary path (registered case def が fallback に優先)
//   §3 vs not(caseColor) 非対称 (2色{X,Y} で caseColorNot=true / not(caseColor)=false)
//   §4 additivity — caseColor positive 不変 / 既存 cond 不変
// rules: 17 (条件), 20 (色), 25。spec: .claude/specs/engine-additive-casecolornot-design.md
import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition } from '@/engine/types';

function caseDef(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors, level: 8, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  s = createEmptyGameState();
});

// 事件色を runtime fallback (case.cardId='') 経由でセット
function setCaseColors(colors: string[]) {
  s.players.self.case.colors = colors;
  s.players.self.case.cardId = '';
}
const cc = (color: string | string[]): Condition => ({ kind: 'caseColorNot', color });
const ev = (cond: Condition) => evalCond(s, cond, makeCtx());

describe('§1 caseColorNot — fallback colors path', () => {
  it('単色 caseColorNot=青: mono-青 false / mono-赤 true / mono-緑 true', () => {
    setCaseColors(['青']); expect(ev(cc('青'))).toBe(false); // mono-X → 除外
    setCaseColors(['赤']); expect(ev(cc('青'))).toBe(true);  // 赤∉{青}
    setCaseColors(['緑']); expect(ev(cc('青'))).toBe(true);  // 緑∉{青}
  });
  it('2色{青,赤} caseColorNot=青: true (公式 B08079 some説 — 赤を持つ)', () => {
    setCaseColors(['青', '赤']); expect(ev(cc('青'))).toBe(true);
  });
  it('空事件色: 任意の caseColorNot で false (「X以外の色」が存在しない)', () => {
    setCaseColors([]); expect(ev(cc('青'))).toBe(false);
  });
  it('array caseColorNot=[青,赤]: 全色⊆なら false / 外があれば true', () => {
    setCaseColors(['青', '赤']); expect(ev(cc(['青', '赤']))).toBe(false);      // 全色 ∈ {青,赤}
    setCaseColors(['青', '赤', '緑']); expect(ev(cc(['青', '赤']))).toBe(true); // 緑∉{青,赤}
    setCaseColors(['緑']); expect(ev(cc(['青', '赤']))).toBe(true);
  });
});

describe('§2 caseColorNot — lookupCardDef primary path', () => {
  it('registered case def の colors が primary (fallback colors より優先)', () => {
    registerCardDef(caseDef('CASE_BR', ['青', '赤']));
    s.players.self.case.cardId = 'CASE_BR';
    s.players.self.case.colors = []; // fallback は空でも def の {青,赤} を参照
    expect(ev(cc('青'))).toBe(true); // 赤を持つ
  });
  it('primary def {青} が fallback {赤} に優先 → caseColorNot=青 は false', () => {
    registerCardDef(caseDef('CASE_BLUE', ['青']));
    s.players.self.case.cardId = 'CASE_BLUE';
    s.players.self.case.colors = ['赤', '緑']; // fallback なら true だが primary {青} mono → false
    expect(ev(cc('青'))).toBe(false);
  });
});

describe('§3 vs not(caseColor) 非対称 (新 kind 必須の根拠)', () => {
  it('2色{青,赤}: caseColorNot=青 は true / not(caseColor=青) は false', () => {
    setCaseColors(['青', '赤']);
    expect(ev(cc('青'))).toBe(true);
    expect(ev({ kind: 'not', c: { kind: 'caseColor', color: '青' } })).toBe(false);
  });
  it('mono-{青}: 両者一致 (caseColorNot=青 false / not(caseColor=青) false)', () => {
    setCaseColors(['青']);
    expect(ev(cc('青'))).toBe(false);
    expect(ev({ kind: 'not', c: { kind: 'caseColor', color: '青' } })).toBe(false);
  });
});

describe('§4 additivity — 既存 cond 不変', () => {
  it('caseColor positive は unchanged', () => {
    setCaseColors(['青', '赤']);
    expect(ev({ kind: 'caseColor', color: '青' })).toBe(true);
    expect(ev({ kind: 'caseColor', color: '緑' })).toBe(false);
    expect(ev({ kind: 'caseColor', color: ['緑', '赤'], combine: 'and' })).toBe(false);
  });
  it('caseColorNot 未使用の state は他 cond 不変 (true/false リテラル)', () => {
    expect(ev({ kind: 'true' })).toBe(true);
    expect(ev({ kind: 'false' })).toBe(false);
  });
});

describe('§5 hardening — review nit 反映 (faithful-copy / 退化 pin)', () => {
  it('opp-owner: ctx.source.player=opp は相手事件を参照 (caseColor と同 owner 抽出)', () => {
    s.players.opp.case.colors = ['青', '赤'];
    s.players.opp.case.cardId = '';
    s.players.self.case.colors = ['青']; // 自分側は mono-青 (混同してれば false)
    const oppCtx = makeCtx({ source: { player: 'opp', area: 'scene' } });
    expect(evalCond(s, cc('青'), oppCtx)).toBe(true); // 相手事件 {青,赤} → 赤を持つ
    expect(evalCond(s, cc('青'), makeCtx())).toBe(false); // self事件 {青} mono → false
  });
  it('cond.color=[] 退化: notSet空 → 事件色1つでも true / 空事件色 false (vacuous some)', () => {
    setCaseColors(['青']); expect(ev(cc([]))).toBe(true);  // 「色なし以外」= 何色でも該当
    setCaseColors([]); expect(ev(cc([]))).toBe(false);     // 事件色空 → some over empty = false
  });
  it('d?.colors=[] (登録 def の colors 空) は ?? で fallback に落ちない (caseColor と同優先順)', () => {
    registerCardDef(caseDef('CASE_EMPTY', [])); // colors:[] は非 nullish
    s.players.self.case.cardId = 'CASE_EMPTY';
    s.players.self.case.colors = ['赤']; // fallback なら true だが primary [] 採用 → false
    expect(ev(cc('青'))).toBe(false);
  });
});
