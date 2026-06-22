import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'specs', 'catalog-survey-2026-06-06');
const bucket = process.argv[2] ?? 'greenCandidate';
const start = Number(process.argv[3] ?? 0);
const count = Number(process.argv[4] ?? 60);
const d = JSON.parse(readFileSync(join(DIR, 'classify-triage.json'), 'utf8'));
const arr = d[bucket] as { rep: string; size: number; kind: string; text: string }[];
console.error(`${bucket}: ${arr.length} entries; showing ${start}..${start + count}`);
for (const e of arr.slice(start, start + count)) {
  console.error(`${e.rep} x${e.size} [${e.kind[0]}] ${e.text.slice(0, 160).replace(/\n/g, ' ')}`);
}
