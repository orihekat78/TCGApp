// Track B compiler — shipped DSL dump (oracle 入力)。
// ALL_CARDS (出荷済 CardDef 全件) → canonical JSON。origin/main checkout 上で実行すること。
// 使い方: npx tsx scripts/compiler/dump-shipped.ts  → .tmp/compiler/shipped-dsl.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../../src/cards/index.js';

const require = createRequire(import.meta.url);
const { canonicalCard, hasClosure } = require('./canonical.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cards = [...ALL_CARDS]
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  .map((def) => ({ ...canonicalCard(def), hasClosure: hasClosure(def.abilities || []) }));

const dupCheck = new Set<string>();
for (const c of cards) {
  if (dupCheck.has(c.id as string)) throw new Error(`duplicate shipped id: ${c.id}`);
  dupCheck.add(c.id as string);
}

const outDir = path.join(__dirname, '..', '..', '.tmp', 'compiler');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'shipped-dsl.json'), JSON.stringify({ count: cards.length, cards }, null, 1));

const closures = cards.filter((c) => c.hasClosure).length;
console.log(`shipped-dsl: ${cards.length} cards (closure-bearing: ${closures})`);
