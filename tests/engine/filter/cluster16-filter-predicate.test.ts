// engine cluster16 — filter-predicate 表現力完成 (card-name EXCLUSION + deckReveal cross-field OR)
// spec: .claude/specs/engine-cluster16-filter-predicate-expressiveness-design.md
//
// 検証 (opus 3-lens 敵対設計レビュー whiudba3c が要求した pin):
//   G1 cardNameNot を **3つの filter-eval サイト** で honor:
//     ① matchOneFilter (candidates.ts、全 area pick / sceneHas 委譲)
//     ② boundMatchesFilter (cond/eval.ts、第4の inline サイト = BLOCKER fix)
//     ③ targetFilterToPredicate (atom-handlers.ts、deckRevealUntil 経由で間接)
//   G2 deckRevealUntil の filterAny = AND-of(filter, OR(filterAny)) (candidates.ts と同一意味論)
//   split-name (rules/19): いずれかの component 一致で除外。additive 安全: 未指定で skip。
// rules: 15 (まで=0可), 19 (複数名カード split-name)

import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { makeCtx } from '../../helpers/fixtures';
import type { CardDef, GameState, Candidate, EffectCtx } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.no ?? 'NO', kind: 'character', names: ['default'],
    colors: [], traits: [], level: 4, ap: 4000, lp: 1, rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...o,
  };
}
const cardCand = (cardId: string): Candidate => ({ kind: 'card', cardId, area: 'deck', player: 'self' });
const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);

describe('cluster16 — cardNameNot via matchOneFilter (candidates / sceneHas 委譲)', () => {
  beforeEach(() => {
    _resetRegistry();
    registerCardDef(defOf({ id: 'KIDO', names: ['萩原千速'], traits: ['警察'] }));
    registerCardDef(defOf({ id: 'OTHER', names: ['松田陣平'], traits: ['警察'] }));
    // rules/19: 複数名カードは names に component を明示列挙 (実 card-data 同形、cluster15 test 同様)
    registerCardDef(defOf({ id: 'SPLIT', names: ['江戸川コナン＆工藤新一', '江戸川コナン', '工藤新一'], traits: ['高校生'] }));
  });
  const s = () => createEmptyGameState();

  it('cardNameNot=[萩原千速] は 萩原千速 を除外 / 松田陣平 は通過', () => {
    const f = { cardNameNot: ['萩原千速'] };
    expect(matchOneFilter(s(), 'KIDO', f, null, cardCand('KIDO'))).toBe(false);
    expect(matchOneFilter(s(), 'OTHER', f, null, cardCand('OTHER'))).toBe(true);
  });

  it('split-name (rules/19): cardNameNot=[工藤新一] は 江戸川コナン＆工藤新一 を除外 (component 一致)', () => {
    expect(matchOneFilter(s(), 'SPLIT', { cardNameNot: ['工藤新一'] }, null, cardCand('SPLIT'))).toBe(false);
    // 制御: positive cardName=[工藤新一] は同カードを一致 (splitter 動作確認)
    expect(matchOneFilter(s(), 'SPLIT', { cardName: ['工藤新一'] }, null, cardCand('SPLIT'))).toBe(true);
  });

  it('cardName + cardNameNot 併用 = AND (positive 一致 かつ 除外不一致)', () => {
    // trait 警察 で絞り、萩原千速 を除外
    const f = { trait: ['警察'], cardNameNot: ['萩原千速'] };
    expect(matchOneFilter(s(), 'KIDO', f, null, cardCand('KIDO'))).toBe(false);  // 警察だが除外名
    expect(matchOneFilter(s(), 'OTHER', f, null, cardCand('OTHER'))).toBe(true); // 警察 かつ 非除外
  });

  it('additive 安全: cardNameNot 未指定なら positive cardName のみで判定 (既存挙動不変)', () => {
    expect(matchOneFilter(s(), 'KIDO', { cardName: ['萩原千速'] }, null, cardCand('KIDO'))).toBe(true);
    expect(matchOneFilter(s(), 'KIDO', {}, null, cardCand('KIDO'))).toBe(true);
  });
});

describe('cluster16 — cardNameNot via boundMatchesFilter (cond/eval 第4経路 = BLOCKER fix)', () => {
  beforeEach(() => {
    _resetRegistry();
    registerCardDef(defOf({ id: 'KIDO', names: ['萩原千速'] }));
    registerCardDef(defOf({ id: 'OTHER', names: ['松田陣平'] }));
  });
  const ctxBound = (cardId: string): EffectCtx =>
    makeCtx({ bindings: { b: [{ kind: 'card', cardId, area: 'deck', player: 'self' }] } });

  it('boundMatchesFilter+cardNameNot: bound カードが除外名なら false / 非除外名なら true', () => {
    const cond = { kind: 'boundMatchesFilter', bindKey: 'b', filter: { cardNameNot: ['萩原千速'] } } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxBound('KIDO'))).toBe(false);
    expect(evalCond(createEmptyGameState(), cond, ctxBound('OTHER'))).toBe(true);
  });
});

describe('cluster16 — deckRevealUntil cardNameNot + filterAny OR (targetFilterToPredicate / G2)', () => {
  beforeEach(() => {
    setHuman(null); // AI 経路 = 先頭 match 自動採用 (pick surface 無し)
    _resetRegistry();
    registerCardDef(defOf({ id: 'KIDO', names: ['萩原千速'], traits: ['警察'] }));
    registerCardDef(defOf({ id: 'MATSU', names: ['松田陣平'], traits: ['警察'] }));
    registerCardDef(defOf({ id: 'BIG', names: ['ビッグジュエル'], traits: ['宝石'] }));
    registerCardDef(defOf({ id: 'KAITO', names: ['怪盗キッド'], traits: ['怪盗'] }));
  });
  function reveal(args: Record<string, unknown>): string | null {
    const st: GameState = createEmptyGameState();
    st.players.self.deck = args.deck as string[];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', cardId: 'X' } });
    runAtom(st, 'deckRevealUntil', { player: 'self', bindMatch: 'm', ...args }, ctx);
    const m = ctx.bindings['m'] as Candidate[] | undefined;
    return m && m.length ? (m[0] as { cardId: string }).cardId : null;
  }

  it('cardNameNot=[萩原千速]: deck 先頭の 萩原千速 を飛ばし 松田陣平 を match', () => {
    expect(reveal({ deck: ['KIDO', 'MATSU'], filter: { cardNameNot: ['萩原千速'], trait: ['警察'] } })).toBe('MATSU');
  });

  it('filterAny OR: [{cardName:怪盗キッド},{trait:宝石}] は名 or 特徴いずれか一致を match (cross-field OR)', () => {
    // deck: KIDO(警察,名萩原千速=不一致) → BIG(特徴宝石=trait 一致) を match
    expect(reveal({ deck: ['KIDO', 'BIG'], filterAny: [{ cardName: ['怪盗キッド'] }, { trait: ['宝石'] }] })).toBe('BIG');
    // deck: MATSU(不一致) → KAITO(名怪盗キッド=cardName 一致)
    expect(reveal({ deck: ['MATSU', 'KAITO'], filterAny: [{ cardName: ['怪盗キッド'] }, { trait: ['宝石'] }] })).toBe('KAITO');
  });

  it('filterAny[i].cardNameNot も honor (OR-element 内 negation)', () => {
    // filterAny=[{trait:警察, cardNameNot:[萩原千速]}] → KIDO(警察だが除外名) skip → MATSU(警察非除外) match
    expect(reveal({ deck: ['KIDO', 'MATSU'], filterAny: [{ trait: ['警察'], cardNameNot: ['萩原千速'] }] })).toBe('MATSU');
  });

  it('AND-of(filter, OR(filterAny)) 意味論: filter で AND 絞り後に filterAny OR (candidates.ts と同一)', () => {
    // filter=trait:警察 (AND) + filterAny=[{cardName:松田陣平},{cardName:怪盗キッド}] (OR)
    // KIDO(警察だが名 OR 不一致) skip → MATSU(警察 かつ 名一致) match
    expect(reveal({ deck: ['KIDO', 'MATSU'], filter: { trait: ['警察'] }, filterAny: [{ cardName: ['松田陣平'] }, { cardName: ['怪盗キッド'] }] })).toBe('MATSU');
  });
});
