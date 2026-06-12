/**
 * Register Task A cards into src/cards/_reuse/index.ts.
 * Reads .tmp-taskA-registered.json ([{id,pkg}]) + a batch comment from argv[2].
 * Inserts `import { ID } from '../pkg/ID.js';` before the REUSE_CARDS export, and
 * the ids (under a comment) before the array's closing `];`. Idempotent (skips existing).
 */
const fs = require('fs');
const path = require('path');

const IDX = path.join(__dirname, '..', 'src', 'cards', '_reuse', 'index.ts');
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.tmp-taskA-registered.json'), 'utf8'));
const label = process.argv[2] || 'Task A batch';

let src = fs.readFileSync(IDX, 'utf8');

const EXPORT_LINE = 'export const REUSE_CARDS: CardDef[] = [';
const exportIdx = src.indexOf(EXPORT_LINE);
if (exportIdx < 0) throw new Error('REUSE_CARDS export not found');

// build imports (skip ids already imported)
const newImports = [];
const newIds = [];
for (const { id, pkg } of reg) {
  if (new RegExp(`\\bimport \\{ ${id} \\}`).test(src)) continue;
  newImports.push(`import { ${id} } from '../${pkg}/${id}.js';`);
  newIds.push(id);
}
if (!newIds.length) {
  console.log('nothing to register (all present)');
  process.exit(0);
}

// insert imports just before the export line
const before = src.slice(0, exportIdx).replace(/\n+$/, '\n');
const after = src.slice(exportIdx);
src = before + newImports.join('\n') + '\n\n' + after;

// insert array entries before the final `];` that closes REUSE_CARDS
const arrStart = src.indexOf(EXPORT_LINE);
const closeIdx = src.indexOf('\n];', arrStart);
if (closeIdx < 0) throw new Error('REUSE_CARDS closing not found');
const entry = `  // ${label}\n  ${newIds.join(', ')},`;
src = src.slice(0, closeIdx) + '\n' + entry + src.slice(closeIdx);

fs.writeFileSync(IDX, src);
console.log(`registered ${newIds.length} cards: ${newIds.join(', ')}`);
