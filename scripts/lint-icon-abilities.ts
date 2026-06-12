// lint:icon-abilities — TSV の cutIn / hirameki 列が非空なのに、出荷 def に該当アイコン能力が
// 無いカードを fail にする (BUG-140 防止策の恒久化、defHasKeyword = 単一真実源で判定)。
// 旧 scripts/audit-icon-abilities.mts (report-only) を lint 化したもの (2026-06-13)。
// DEFER_ALLOWLIST: 実装を意図的に見送ったカード (.claude/specs/DEFERRED-INDEX.md に理由記載)。
// allowlist 記載なのに欠落が解消されている場合も fail (stale allowlist 検知)。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_CARDS } from '../src/cards/index.js';
import { defHasKeyword } from '../src/engine/read/keyword.js';

const ROOT = resolve(import.meta.dirname, '..');
const DATA = resolve(ROOT, '.claude/specs/cards-data');

// id:icon → DEFER 理由 (DEFERRED-INDEX.md と同期)
const DEFER_ALLOWLIST = new Map<string, string>([
  ['B05039:cutin', 'コンタクト対象キャラの特徴条件 (〚特徴［探偵］〛に【カットイン】した場合) が Condition union に無い'],
  ['B06035:hirameki', 'hirameki fire 経路内の chain (してもよい→そうした場合) + caseTrait/caseStatus gate が未確証'],
]);

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

const violations: string[] = [];
const deferredSeen = new Set<string>();
for (const r of rows) {
  const def = registered.get(r.id);
  if (!def) continue; // 未出荷は対象外
  for (const [icon, text, kw] of [
    ['cutin', r.cutIn, 'カットイン'],
    ['hirameki', r.hirameki, 'ヒラメキ'],
  ] as const) {
    if (!text || defHasKeyword(def, kw)) continue;
    const key = `${r.id}:${icon}`;
    if (DEFER_ALLOWLIST.has(key)) {
      deferredSeen.add(key);
      continue;
    }
    violations.push(`MISSING-${icon.toUpperCase()} ${r.set}/${r.id}: ${text.slice(0, 60)}`);
  }
}

// stale allowlist 検知 (補修されたのに allowlist に残っている)
for (const key of DEFER_ALLOWLIST.keys()) {
  if (!deferredSeen.has(key)) violations.push(`STALE-ALLOWLIST ${key}: 欠落が解消済 — DEFER_ALLOWLIST から削除すること`);
}

if (violations.length) {
  console.error(`[lint:icon-abilities] ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('  → TSV cutIn/hirameki 列の能力を実装するか、意図的 DEFER なら DEFERRED-INDEX.md 記載の上 allowlist へ');
  process.exit(1);
}
console.log(`[lint:icon-abilities] OK (shipped=${registered.size}, deferred=${deferredSeen.size})`);
