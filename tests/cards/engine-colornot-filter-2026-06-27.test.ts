// engine additive wave — TargetFilter.colorNot (「【X】以外の色を持つ」, 2026-06-27)。
// cluster16 cardNameNot の color 版。filter-eval 4 site (型 + matchOneFilter / boundMatchesFilter /
// targetFilterToPredicate) を mirror。
//
// semantics (公式 B08079 裁定で確定 — some説):
//   「【X】以外の色を持つ」= X以外の色を1つ以上持つ (colors.some(c => c∉notSet))。
//   mono-X → 除外 / 2色{X,Y} → 該当 (Y を持つ、公式裁定) / mono-Y → 該当。
//   等価: 全色が notSet 内のとき除外。⚠ cardNameNot (any-match 除外) とは 2色で非対称。
//
// 検証:
//   §1 matchOneFilter (target pick / sceneHas cond / auraDelta 再入の正準経路)
//   §2 targetFilterToPredicate (deckRevealUntil path)
//   §3 boundMatchesFilter (bound card inline eval、3経路 sync 必須)
//   §4 additivity — colorNot 未宣言は不変 / color positive と co-exist
// rules: 15 (まで=0可), 20 (色), 19。spec: .claude/specs/engine-additive-colornot-filter-design.md
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { targetFilterToPredicate } from '@/engine/effect/atom-handlers/_shared';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Candidate } from '@/engine/types';

function ch(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const MONO_BLUE = ch('MONO_BLUE', ['青']);
const MONO_RED = ch('MONO_RED', ['赤']);
const MONO_GREEN = ch('MONO_GREEN', ['緑']);
const TWO_BR = ch('TWO_BR', ['青', '赤']); // 公式 B08079: 黒+他 = 「【黒】以外の色を持つ」を満たす ⇒ 青+赤 も「【青】以外」満たす

function cand(uid: string, cardId: string): Candidate {
  return { kind: 'char', uid, cardId, player: 'self' } as Candidate;
}

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [MONO_BLUE, MONO_RED, MONO_GREEN, TWO_BR]) registerCardDef(d);
  s = createEmptyGameState();
});

// scene candidate を 1 枚置いて matchOneFilter を呼ぶ helper。
function mof(cardId: string, filter: Parameters<typeof matchOneFilter>[2]): boolean {
  const sc = sceneChar(cardId, `${cardId}#1`);
  s.players.self.scene = [sc];
  return matchOneFilter(s, cardId, filter, sc, cand(`${cardId}#1`, cardId));
}

describe('§1 matchOneFilter — colorNot (target pick / sceneHas cond)', () => {
  it('単色 colorNot=青: mono-青除外 / mono-赤該当 / mono-緑該当', () => {
    expect(mof('MONO_BLUE', { colorNot: '青' })).toBe(false); // mono-X → 除外
    expect(mof('MONO_RED', { colorNot: '青' })).toBe(true);   // 赤∉{青} → 該当
    expect(mof('MONO_GREEN', { colorNot: '青' })).toBe(true); // 緑∉{青} → 該当
  });
  it('2色{青,赤} colorNot=青: 該当 (公式 B08079 some説 — 赤を持つ)', () => {
    expect(mof('TWO_BR', { colorNot: '青' })).toBe(true);
  });
  it('array colorNot=[青,赤]: mono-緑のみ該当 / mono-青・mono-赤・2色{青,赤}は全除外', () => {
    expect(mof('MONO_GREEN', { colorNot: ['青', '赤'] })).toBe(true);
    expect(mof('MONO_BLUE', { colorNot: ['青', '赤'] })).toBe(false);
    expect(mof('MONO_RED', { colorNot: ['青', '赤'] })).toBe(false);
    expect(mof('TWO_BR', { colorNot: ['青', '赤'] })).toBe(false); // 全色 ∈ {青,赤} → 除外
  });
});

describe('§2 targetFilterToPredicate — colorNot (deckRevealUntil path)', () => {
  const p = (filter: Parameters<typeof targetFilterToPredicate>[0]) => targetFilterToPredicate(filter);
  it('単色 colorNot=青', () => {
    const pred = p({ colorNot: '青' });
    expect(pred('MONO_BLUE')).toBe(false);
    expect(pred('MONO_RED')).toBe(true);
    expect(pred('MONO_GREEN')).toBe(true);
  });
  it('2色{青,赤} colorNot=青: 該当', () => {
    expect(p({ colorNot: '青' })('TWO_BR')).toBe(true);
  });
  it('array colorNot=[青,赤]', () => {
    const pred = p({ colorNot: ['青', '赤'] });
    expect(pred('MONO_GREEN')).toBe(true);
    expect(pred('TWO_BR')).toBe(false);
  });
  it('color positive + colorNot AND (§2 でも順序固定)', () => {
    expect(p({ color: '赤', colorNot: '青' })('TWO_BR')).toBe(true);   // 赤持ち AND 青以外の色持ち
    expect(p({ color: '赤', colorNot: '青' })('MONO_BLUE')).toBe(false); // color:赤 不成立
  });
});

describe('§3 boundMatchesFilter — colorNot (bound card inline eval)', () => {
  const bm = (cardId: string, filter: Parameters<typeof matchOneFilter>[2]) =>
    evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter } as never, makeCtx({ bindings: { b: [{ cardId }] } }));
  it('単色 colorNot=青', () => {
    expect(bm('MONO_BLUE', { colorNot: '青' })).toBe(false);
    expect(bm('MONO_RED', { colorNot: '青' })).toBe(true);
  });
  it('2色{青,赤} colorNot=青: 該当', () => {
    expect(bm('TWO_BR', { colorNot: '青' })).toBe(true);
  });
  it('array colorNot=[青,赤]: 2色{青,赤}除外 / mono-緑該当 (§3 array 枝)', () => {
    expect(bm('TWO_BR', { colorNot: ['青', '赤'] })).toBe(false);
    expect(bm('MONO_GREEN', { colorNot: ['青', '赤'] })).toBe(true);
  });
});

describe('§4 additivity — colorNot 未宣言は不変 / color positive と co-exist', () => {
  it('colorNot 未宣言: 全 site で全カード該当 (回帰0)', () => {
    expect(mof('MONO_BLUE', {})).toBe(true);
    expect(targetFilterToPredicate({})('MONO_BLUE')).toBe(true);
    expect(evalCond(s, { kind: 'boundMatchesFilter', bindKey: 'b', filter: {} } as never, makeCtx({ bindings: { b: [{ cardId: 'MONO_BLUE' }] } }))).toBe(true);
  });
  it('colorNot + color positive 併記 = AND', () => {
    // color:赤 AND colorNot:青 — TWO_BR は赤を持ち(positive OK) かつ青以外(赤)を持つ(colorNot OK) → 該当
    expect(mof('TWO_BR', { color: '赤', colorNot: '青' })).toBe(true);
    // MONO_BLUE は color:赤 不成立 → 除外
    expect(mof('MONO_BLUE', { color: '赤', colorNot: '青' })).toBe(false);
    // MONO_RED は color:赤 OK だが colorNot:赤 で除外
    expect(mof('MONO_RED', { color: '赤', colorNot: '赤' })).toBe(false);
  });
});

describe('§5 edge — 色なし def は colorNot で除外 (保守; 「【X】以外の色」が存在しない)', () => {
  it('colors:[] のカードは任意の colorNot で除外', () => {
    const COLORLESS = ch('COLORLESS', []);
    registerCardDef(COLORLESS);
    expect(mof('COLORLESS', { colorNot: '青' })).toBe(false);
    expect(targetFilterToPredicate({ colorNot: '青' })('COLORLESS')).toBe(false);
    // colorNot 未宣言なら色なしでも該当 (回帰0)
    expect(mof('COLORLESS', {})).toBe(true);
  });
});
