// Static metadata boundary for DECK and CARDS. Engine definitions are consumed only by the generator.

import { CARD_CATALOG } from './cardCatalog.generated';
import type { CardColor, CardDef, CardKind } from './types';

export function cardSetCode(num: string): string {
  const booster = /^B(\d{2})/i.exec(num);
  if (booster) return `CT-P${booster[1]}`;
  const deck = /^D(\d{2})/i.exec(num);
  if (deck) return `CT-D${deck[1]}`;
  if (/^PR/i.test(num)) return 'PR';
  return 'その他';
}

export const CARD_POOL: readonly CardDef[] = CARD_CATALOG;

export const ALL_CARD_SETS: readonly string[] = (() => {
  const sets = [...new Set(CARD_POOL.map((card) => card.setCode ?? cardSetCode(card.num)))];
  const rank = (code: string) => code.startsWith('CT-P') ? 0 : code.startsWith('CT-D') ? 1 : code === 'PR' ? 2 : 3;
  return sets.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ja', { numeric: true }));
})();

const NUM_TO_ID = new Map<string, string>(CARD_POOL.map((card) => [card.num, card.id]));

export function cardIdOf(num: string): string {
  return NUM_TO_ID.get(num) ?? num;
}

export function countsByCardId(
  entries: readonly { num: string; count: number }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = cardIdOf(entry.num);
    counts.set(id, (counts.get(id) ?? 0) + entry.count);
  }
  return counts;
}

export const DISTINCT_CARDS: readonly CardDef[] = (() => {
  const seen = new Set<string>();
  const cards: CardDef[] = [];
  for (const card of CARD_POOL) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
})();

export const DISTINCT_CARD_COUNT = DISTINCT_CARDS.length;

const CARD_VARIANTS_BY_ID: ReadonlyMap<string, readonly CardDef[]> = (() => {
  const variants = new Map<string, CardDef[]>();
  for (const card of CARD_POOL) {
    const group = variants.get(card.id);
    if (group) group.push(card);
    else variants.set(card.id, [card]);
  }
  return variants;
})();

export function variantsOfId(id: string): CardDef[] {
  return [...(CARD_VARIANTS_BY_ID.get(id) ?? [])];
}

const PARTNER_TO_CASE: Record<string, string> = {
  D08001: 'D08026', D08002: 'D08026',
  D11001: 'D11021', D11002: 'D11021',
};

export function defaultCaseForPartner(partnerNum: string): string {
  if (PARTNER_TO_CASE[partnerNum]) return PARTNER_TO_CASE[partnerNum]!;
  const partner = CARD_POOL.find((card) => card.num === partnerNum);
  return partner?.color === 'yellow' ? 'D11021' : 'D08026';
}

export const CASE_CARDS: readonly CardDef[] = CARD_POOL.filter((card) => card.type === 'case');
export const PARTNER_CARDS: readonly CardDef[] = CARD_POOL.filter((card) => card.type === 'partner');

export interface CardFilter {
  color?: CardColor;
  type?: CardKind;
  minCost?: number;
  maxCost?: number;
  rarity?: string;
  q?: string;
}

export function getCards(filter: CardFilter = {}): CardDef[] {
  return CARD_POOL.filter((card) => {
    if (filter.color && !(card.colors ?? [card.color]).includes(filter.color)) return false;
    if (filter.type && card.type !== filter.type) return false;
    if (filter.rarity && card.rarity !== filter.rarity) return false;
    if (filter.minCost != null && (card.cost ?? 0) < filter.minCost) return false;
    if (filter.maxCost != null && (card.cost ?? 0) > filter.maxCost) return false;
    if (filter.q) {
      const query = filter.q.toLowerCase();
      const inName = card.name.toLowerCase().includes(query);
      const inNum = card.num.toLowerCase().includes(query);
      const inId = card.id.toLowerCase().includes(query);
      const inFeatures = (card.features ?? []).some((feature) => feature.toLowerCase().includes(query));
      if (!inName && !inNum && !inId && !inFeatures) return false;
    }
    return true;
  });
}
