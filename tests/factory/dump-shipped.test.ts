import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from '@/cards';
import * as fs from 'fs';

describe('dump shipped abilities', () => {
  it('全出荷カードの abilities を JSON 化', () => {
    const seen = new Set<string>();
    const out = ALL_CARDS.filter((c: any) => { const id = c.id; if (seen.has(id)) return false; seen.add(id); return true; })
      .map((c: any) => ({ id: c.id,
        abilities: JSON.parse(JSON.stringify(c.abilities ?? [], (_k, v) => typeof v === 'function' ? '<fn>' : v)) }));
    fs.mkdirSync('.tmp/card-factory', { recursive: true });
    fs.writeFileSync('.tmp/card-factory/shipped-abilities.json', JSON.stringify(out));
    expect(out.length).toBeGreaterThan(1000);
  });
});
