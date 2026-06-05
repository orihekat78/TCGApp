import { engine } from '../src/engine/index.js';
import { ALL_CARDS, REUSE_CARDS } from '../src/cards/index.js';

// full-registry duplicate id check
const counts: Record<string, number> = {};
for (const d of ALL_CARDS) counts[d.id] = (counts[d.id] || 0) + 1;
const dups = Object.entries(counts).filter(([, n]) => n > 1);
console.log('ALL_CARDS total:', ALL_CARDS.length, '| unique ids:', Object.keys(counts).length, '| dup ids:', dups.length);
if (dups.length) console.log('DUPLICATES:', JSON.stringify(dups.slice(0, 40)));

// validate every registered card
let bad = 0;
for (const d of ALL_CARDS) {
  const r = engine.cards.validate(d);
  if (!r.ok) { bad++; if (bad <= 20) console.log('INVALID', d.id, JSON.stringify(r.errors)); }
}
console.log('validate failures across ALL_CARDS:', bad);
console.log('REUSE_CARDS:', REUSE_CARDS.length);
