// 一回性監査: TSV の cutIn / hirameki 列が非空なのに、出荷 def に該当アイコン能力が無いカードを列挙
// (BUG-140 調査。defHasKeyword = 単一真実源で判定)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_CARDS } from '../src/cards/index.js';
import { defHasKeyword } from '../src/engine/read/keyword.js';

const ROOT = resolve(import.meta.dirname, '..');
const DATA = resolve(ROOT, '.claude/specs/cards-data');

const registered = new Map(ALL_CARDS.map((d) => [d.id, d]));
const rows: { id: string; set: string; cutIn: string; hirameki: string }[] = [];

for (const set of readdirSync(DATA)) {
  const dir = resolve(DATA, set);
  for (const kind of ['character', 'event']) {
    const f = resolve(dir, `${kind}.tsv`);
    if (!existsSync(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    const header = lines[0]!.split('\t');
    const iId = header.indexOf('cardNum');
    const iCut = header.indexOf('cutIn');
    const iHir = header.indexOf('hirameki');
    if (iId === -1 || iCut === -1) continue;
    for (const line of lines.slice(1)) {
      const cols = line.split('\t');
      const id = cols[iId]?.trim();
      if (!id) continue;
      rows.push({ id, set, cutIn: cols[iCut]?.trim() ?? '', hirameki: cols[iHir]?.trim() ?? '' });
    }
  }
}

let missCut = 0;
let missHir = 0;
for (const r of rows) {
  const def = registered.get(r.id);
  if (!def) continue; // 未出荷は対象外
  if (r.cutIn && !defHasKeyword(def, 'カットイン')) {
    console.log(`MISSING-CUTIN ${r.set}/${r.id}: ${r.cutIn.slice(0, 60)}`);
    missCut++;
  }
  if (r.hirameki && !defHasKeyword(def, 'ヒラメキ')) {
    console.log(`MISSING-HIRAMEKI ${r.set}/${r.id}: ${r.hirameki.slice(0, 60)}`);
    missHir++;
  }
}
console.log(`---\nshipped=${registered.size} tsvRows=${rows.length} missingCutin=${missCut} missingHirameki=${missHir}`);
