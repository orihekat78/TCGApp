import { CARD_POOL } from "./cardPool";
import type { DeckRecord } from "./types";

export interface DeckStats {
  total: number;
  colors: Partial<Record<string, number>>;
  costs: Partial<Record<number, number>>;
  types: Partial<Record<string, number>>;
}

export function deckStats(deck: DeckRecord): DeckStats {
  let total = 0;
  const colors: DeckStats["colors"] = {};
  const costs: DeckStats["costs"] = {};
  const types: DeckStats["types"] = {};
  for (const entry of deck.cards) {
    const card = CARD_POOL.find((candidate) => candidate.num === entry.num);
    if (!card) continue;
    total += entry.count;
    for (const color of card.colors ?? [card.color]) {
      colors[color] = (colors[color] ?? 0) + entry.count;
    }
    types[card.type] = (types[card.type] ?? 0) + entry.count;
    if (card.cost != null) {
      const cost = Math.min(card.cost, 8);
      costs[cost] = (costs[cost] ?? 0) + entry.count;
    }
  }
  return { total, colors, costs, types };
}
