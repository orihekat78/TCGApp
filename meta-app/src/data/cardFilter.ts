// spec: .claude/specs/meta-ui/ (Phase 18: Master Duel 風カード絞り込みの共有モジュール)
// CardsScreen / DeckEditor が共通で使う facet フィルタ + ソートの純粋ロジック。
// 色/種別/特徴/キーワード/コスト/レアリティ + 名前・効果テキスト検索。
// 特徴・キーワードは OR/AND 切替可 (複数値 facet)。色/種別/レアリティ/コストは facet 内 OR。

import { T } from '../shared/tokens';
import { CARD_POOL } from './cardPool';
import type { CardColor, CardDef, CardKind } from './types';

export type SortKey = 'num' | 'cost' | 'ap' | 'lp' | 'name';
export type SortDir = 'asc' | 'desc';
export type MatchMode = 'or' | 'and';

export interface CardFilterState {
  q: string;
  colors: CardColor[];
  types: CardKind[];
  features: string[];
  keywords: string[];
  rarities: string[];
  costs: number[]; // チップ値 0..8 (8 = 8 以上)、-1 = コスト無し
  featureMode: MatchMode;
  keywordMode: MatchMode;
}

export const EMPTY_FILTER: CardFilterState = {
  q: '', colors: [], types: [], features: [], keywords: [], rarities: [], costs: [],
  featureMode: 'or', keywordMode: 'or',
};

export const COLOR_META: { c: CardColor; label: string; hex: string }[] = [
  { c: 'blue',   label: '青', hex: T.blue },
  { c: 'yellow', label: '黄', hex: T.yellow },
  { c: 'red',    label: '赤', hex: T.red },
  { c: 'green',  label: '緑', hex: T.green },
  { c: 'purple', label: '紫', hex: T.purple },
];

export const TYPE_META: { t: CardKind; label: string; hex: string }[] = [
  { t: 'character', label: 'キャラ',     hex: T.neonBlue },
  { t: 'event',     label: 'イベント',   hex: T.purple },
  { t: 'partner',   label: 'パートナー', hex: T.gold },
  { t: 'case',      label: '事件',       hex: T.red },
];

const RARITY_HEX: Record<string, string> = {
  D: T.textSecondary, C: T.green, R: T.neonBlue, SR: T.gold, MR: T.red,
};
export function rarityHex(r: string): string {
  return RARITY_HEX[r] ?? T.textMuted;
}

/** CARD_POOL に実在する特徴の一覧 (五十音順)。 */
export const ALL_FEATURES: string[] = (() => {
  const s = new Set<string>();
  for (const c of CARD_POOL) for (const f of c.features ?? []) s.add(f);
  return [...s].sort((a, b) => a.localeCompare(b, 'ja'));
})();

/** CARD_POOL に実在するキーワードの一覧。 */
export const ALL_KEYWORDS: string[] = (() => {
  const s = new Set<string>();
  for (const c of CARD_POOL) for (const k of c.keywords ?? []) s.add(k);
  return [...s];
})();

/** CARD_POOL に実在するレアリティの一覧 (死に枠を出さないため動的)。 */
export const ALL_RARITIES: string[] = (() => {
  const order = ['D', 'C', 'R', 'SR', 'MR'];
  const s = new Set<string>();
  for (const c of CARD_POOL) if (c.rarity) s.add(c.rarity);
  return [...s].sort((a, b) => order.indexOf(a) - order.indexOf(b));
})();

/** コストチップ値 (-1=なし は表示しない。0..8 を提供、8 は 8+)。 */
export const COST_BUCKETS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** カードのコストをチップ値 (0..8) に丸める。コスト無しは -1。 */
export function costBucket(c: CardDef): number {
  return c.cost == null ? -1 : Math.min(c.cost, 8);
}

export function matchesFilter(c: CardDef, f: CardFilterState): boolean {
  if (f.colors.length && !f.colors.includes(c.color)) return false;
  if (f.types.length && !f.types.includes(c.type)) return false;
  if (f.rarities.length && !f.rarities.includes(c.rarity ?? '')) return false;
  if (f.costs.length && !f.costs.includes(costBucket(c))) return false;
  if (f.features.length) {
    const cf = c.features ?? [];
    const ok = f.featureMode === 'and'
      ? f.features.every((x) => cf.includes(x))
      : f.features.some((x) => cf.includes(x));
    if (!ok) return false;
  }
  if (f.keywords.length) {
    const ck = c.keywords ?? [];
    const ok = f.keywordMode === 'and'
      ? f.keywords.every((x) => ck.includes(x))
      : f.keywords.some((x) => ck.includes(x));
    if (!ok) return false;
  }
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    const hay = [c.name, c.num, c.id, ...(c.features ?? []), c.effectShort ?? '']
      .join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** 有効になっている facet の数 (検索文字列を含む)。0 なら無フィルタ。 */
export function activeFilterCount(f: CardFilterState): number {
  return (f.q.trim() ? 1 : 0)
    + f.colors.length + f.types.length + f.features.length
    + f.keywords.length + f.rarities.length + f.costs.length;
}

export function isFilterActive(f: CardFilterState): boolean {
  return activeFilterCount(f) > 0;
}

export function sortCards(cards: readonly CardDef[], key: SortKey, dir: SortDir = 'asc'): CardDef[] {
  const sign = dir === 'asc' ? 1 : -1;
  return cards.slice().sort((a, b) => {
    switch (key) {
      case 'cost': return sign * ((a.cost ?? 99) - (b.cost ?? 99));
      case 'ap':   return sign * ((a.ap ?? -1) - (b.ap ?? -1));
      case 'lp':   return sign * ((a.lp ?? -1) - (b.lp ?? -1));
      case 'name': return sign * a.name.localeCompare(b.name, 'ja');
      case 'num':
      default:     return sign * a.num.localeCompare(b.num);
    }
  });
}

/** 配列トグル (immutable)。 */
export function toggleIn<V>(arr: readonly V[], v: V): V[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
