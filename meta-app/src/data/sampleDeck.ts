// spec: .claude/specs/meta-ui/05-engine-stub.md
// 原典: design-mockups_v2/06-card-data.jsx の SAMPLE_DECK
// 公式ルール準拠: 40 枚ちょうど・同 ID ≤ 3 枚 (rules/02-deck-construction.md)

import type { DeckRecord } from './types';
import { CARD_POOL } from './cardPool';

export const SAMPLE_DECK: DeckRecord = {
  id: 'sample-d08',
  name: '少年探偵団・標準',
  partner: 'D08001',
  case: 'D08026', // 青の古城探索事件
  modified: 0,
  cards: [
    { num: 'D08003', count: 1 },
    { num: 'D08004', count: 2 },
    { num: 'D08005', count: 1 },
    { num: 'D08006', count: 2 },
    { num: 'D08007', count: 1 },
    { num: 'D08008', count: 2 },
    { num: 'D08009', count: 1 },
    { num: 'D08010', count: 2 },
    { num: 'D08011', count: 1 },
    { num: 'D08012', count: 2 },
    { num: 'D08013', count: 1 },
    { num: 'D08014', count: 2 },
    { num: 'D08015', count: 1 },
    { num: 'D08016', count: 2 },
    { num: 'D08017', count: 1 },
    { num: 'D08018', count: 2 },
    { num: 'D08019', count: 1 },
    { num: 'D08020', count: 2 },
    { num: 'D08021', count: 2 },
    { num: 'D08022', count: 3 },
    { num: 'D08023', count: 2 },
    { num: 'D08024', count: 3 },
    { num: 'D08025', count: 3 },
  ],
};

export const SAMPLE_DECK_OPP: DeckRecord = {
  id: 'sample-d11',
  name: '警察・標準',
  partner: 'D11001',
  case: 'D11021', // 千速と重悟の婚活パーティー
  modified: 0,
  cards: [
    // 公式 CT-D11 の印刷カード別収録枚数。
    { num: 'D11003', count: 1 },
    { num: 'D11004', count: 2 },
    { num: 'D11005', count: 1 },
    { num: 'D11006', count: 2 },
    { num: 'D11007', count: 1 },
    { num: 'D11008', count: 2 },
    { num: 'D11009', count: 1 },
    { num: 'D11010', count: 2 },
    { num: 'D11011', count: 3 },
    { num: 'D11012', count: 3 },
    { num: 'D11013', count: 3 },
    { num: 'D11014', count: 3 },
    { num: 'D11015', count: 3 },
    { num: 'D11016', count: 3 },
    { num: 'D11017', count: 3 },
    { num: 'D11018', count: 3 },
    { num: 'D11019', count: 2 },
    { num: 'D11020', count: 2 },
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
