// spec: .claude/specs/meta-ui/05-engine-stub.md
// 原典: design-mockups_v2/06-card-data.jsx の SAMPLE_DECK
// 公式ルール準拠: 40 枚ちょうど・同 ID ≤ 3 枚 (rules/02-deck-construction.md)

import type { DeckRecord } from './types';
import { CARD_POOL } from './cardPool';

export const SAMPLE_DECK: DeckRecord = {
  id: 'sample-d08',
  name: '少年探偵団・標準',
  partner: 'D08001',
  modified: 0,
  cards: [
    { num: 'D08003', count: 2 },
    { num: 'D08005', count: 3 },
    { num: 'D08007', count: 3 },
    { num: 'D08009', count: 3 },
    { num: 'D08011', count: 3 },
    { num: 'D08013', count: 3 },
    { num: 'D08015', count: 3 },
    { num: 'D08017', count: 3 },
    { num: 'D08019', count: 3 },
    { num: 'D08021', count: 3 },
    { num: 'D08023', count: 3 },
    { num: 'D08025', count: 2 },
    { num: 'D11019', count: 3 },
    { num: 'D11020', count: 3 },
  ],
};

export const SAMPLE_DECK_OPP: DeckRecord = {
  id: 'sample-d11',
  name: '警察・標準',
  partner: 'D11001',
  modified: 0,
  cards: [
    { num: 'D11003', count: 2 },
    { num: 'D11005', count: 2 },
    { num: 'D11007', count: 2 },
    { num: 'D11009', count: 3 },
    { num: 'D11011', count: 3 },
    { num: 'D11013', count: 3 },
    { num: 'D11015', count: 3 },
    { num: 'D11017', count: 3 },
    { num: 'D11019', count: 3 },
    { num: 'D11020', count: 3 },
    { num: 'D11021', count: 3 },
    { num: 'D08007', count: 3 },
    { num: 'D08009', count: 3 },
    { num: 'D08011', count: 2 },
    { num: 'D08023', count: 2 },
  ],
};

export interface DeckStats {
  total: number;
  colors: Partial<Record<string, number>>;
  costs: Partial<Record<number, number>>;
  types: Partial<Record<string, number>>;
}

export function deckStats(deck: DeckRecord): DeckStats {
  let total = 0;
  const colors: DeckStats['colors'] = {};
  const costs: DeckStats['costs'] = {};
  const types: DeckStats['types'] = {};
  for (const entry of deck.cards) {
    const card = CARD_POOL.find((c) => c.num === entry.num);
    if (!card) continue;
    total += entry.count;
    colors[card.color] = (colors[card.color] ?? 0) + entry.count;
    types[card.type] = (types[card.type] ?? 0) + entry.count;
    if (card.cost != null) {
      const k = Math.min(card.cost, 8);
      costs[k] = (costs[k] ?? 0) + entry.count;
    }
  }
  return { total, colors, costs, types };
}
