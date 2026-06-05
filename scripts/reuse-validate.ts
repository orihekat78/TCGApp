import { engine } from '../src/engine/index.js';
import { REUSE_CARDS } from '../src/cards/index.js';

let bad = 0;
const ids = new Set<string>();
let dup = 0;
for (const def of REUSE_CARDS) {
  if (ids.has(def.id)) { dup++; console.log('DUP id', def.id); }
  ids.add(def.id);
  const r = engine.cards.validate(def);
  if (!r.ok) { bad++; console.log('INVALID', def.id, JSON.stringify(r.errors)); }
}
console.log(`REUSE_CARDS: ${REUSE_CARDS.length} | invalid: ${bad} | dup-id: ${dup}`);
const byKind: Record<string, number> = {};
for (const d of REUSE_CARDS) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
console.log('by kind:', JSON.stringify(byKind));
