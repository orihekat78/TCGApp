// P-spread generator: base 出荷済 + TSV 全列同文の P variant を slim clone で生成し _reuse/index.ts に登録
const fs = require('fs');
const path = require('path');
const { withCardsDataSnapshot } = require('./cards/official-api.cjs');
// M2後半 (2026-07-10): ROOT hardcode を env 対応に (worktree 運用で spread 0 件になる latent の恒久 fix)。
const ROOT = process.env.CONAN_ROOT || 'C:/Users/arumi/OneDrive/デスクトップ/conan';
const DATA_DIR = path.resolve(process.env.CONAN_CARDS_DATA_DIR || path.join(ROOT, '.claude/specs/cards-data'));

function main() {

const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/compiler/corpus.json'), 'utf8')).cards;
const byId = new Map(corpus.map(c => [c.id, c]));
const shipped = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/compiler/shipped-dsl.json'), 'utf8')).cards.map(c => c.id));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/_hybrid_run/manifest.json'), 'utf8'));
const pool = new Set(manifest.skippedDeferred.flat());

// ---- 1. spread-ready 判定: base shipped + 全列同文 (id/rarity 以外の corpus 全 field 一致) ----
const KIND_JA = { character: 'キャラ', event: 'イベント', case: '事件', partner: 'パートナー' };
const candidates = [];
for (const c of corpus) {
  if (shipped.has(c.id) || pool.has(c.id)) continue;
  const m = c.id.match(/^(.+?)P\d?$/);
  if (!m) continue;
  const base = byId.get(m[1]);
  if (!base || !shipped.has(base.id)) continue;
  // 全列比較 (id, rarity 除外; features は区切り文字揺れ [|,] を正規化して集合比較)
  const strip = (x) => {
    const { id, rarity, ...rest } = x;
    if (typeof rest.features === 'string') rest.features = rest.features.split(/[|,]/).filter(Boolean).sort();
    return JSON.stringify(rest);
  };
  if (strip(base) !== strip(c)) { console.log('SKIP (列差分):', c.id); continue; }
  candidates.push({ p: c, base });
}
console.log('spread-ready:', candidates.length);

// ---- 2. TSV から imageUrl 抽出 ----
function tsvRow(id, pkg) {
  const dir = path.join(DATA_DIR, pkg);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.tsv')) continue;
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols[0] === id) return cols;
    }
  }
  return null;
}

// ---- 3. base file 位置 + export 名確認、P file 生成 ----
const results = [];
for (const { p, base } of candidates) {
  const dir = `ct-${base.pkg}`.replace(/^ct-ct-/, 'ct-'); // pkg が 'p01' 形式か 'ct-p01' 形式か両対応
  let baseFile = path.join(ROOT, 'src/cards', base.pkg, `${base.id}.ts`);
  if (!fs.existsSync(baseFile)) baseFile = path.join(ROOT, 'src/cards', `ct-${base.pkg}`, `${base.id}.ts`);
  if (!fs.existsSync(baseFile)) { console.log('SKIP (base file 不在):', base.id, base.pkg); continue; }
  const baseSrc = fs.readFileSync(baseFile, 'utf8');
  if (!baseSrc.includes(`export const ${base.id}`)) { console.log('SKIP (export 不在):', base.id); continue; }
  const row = tsvRow(p.id, path.basename(path.dirname(baseFile)));
  if (!row) { console.log('SKIP (TSV row 不在):', p.id); continue; }
  const img = row.find(c => /^[0-9a-f]+\.(jpg|png)$/i.test(c)) || '';
  if (!img) { console.log('SKIP (imageUrl 不在):', p.id); continue; }
  const pkgDir = path.basename(path.dirname(baseFile));
  const outFile = path.join(path.dirname(baseFile), `${p.id}.ts`);
  if (fs.existsSync(outFile)) { console.log('SKIP (既存):', p.id); continue; }
  const content = `// cards/${pkgDir}/${p.id} ${p.title} (${KIND_JA[p.kind] || p.kind} パラレル) — ${base.id} の絵柄違い (同 cardId ${p.cardId})
// TSV 全列同文 (rarity ${p.rarity} / imageUrl のみ差分) — rules/02 同 ID。句マッピングは ${base.id}.ts ヘッダ参照。
import type { CardDef } from '@/engine/types';
import { ${base.id} } from './${base.id}.js';

export const ${p.id}: CardDef = {
  ...${base.id},
  id: '${p.id}',
  no: '${p.cardId}/${p.id}',
  imageUrl: '${img}',
  rarity: '${p.rarity}',
};
`;
  results.push({ id: p.id, pkgDir, outFile, content });
}

// ---- 4. 書込み + _reuse/index.ts 追記 ----
const DRY = process.argv.includes('--dry');
if (DRY) {
  for (const r of results) console.log('WOULD WRITE:', r.outFile);
  console.log('total:', results.length);
  process.exit(0);
}
for (const r of results) fs.writeFileSync(r.outFile, r.content);

const reusePath = path.join(ROOT, 'src/cards/_reuse/index.ts');
let reuse = fs.readFileSync(reusePath, 'utf8');
const importLines = results.map(r => `import { ${r.id} } from '../${r.pkgDir}/${r.id}.js';`).join('\n');
// import block 末尾 = 最後の import 行の後
const lastImport = reuse.lastIndexOf("\nimport { ");
const endOfLastImport = reuse.indexOf('\n', reuse.indexOf(';', lastImport));
reuse = reuse.slice(0, endOfLastImport) + '\n' + importLines + reuse.slice(endOfLastImport);
// 配列末尾 (最後の "];") の直前に section 追記
const ids = results.map(r => r.id);
const chunks = [];
for (let i = 0; i < ids.length; i += 8) chunks.push('  ' + ids.slice(i, i + 8).join(', ') + ',');
const section = `  // CARD PHASE P-spread sweep 2026-07-10 (base 出荷済 + TSV 全列同文の slim clone ${ids.length} 枚)\n${chunks.join('\n')}\n`;
const arrClose = reuse.lastIndexOf('];');
reuse = reuse.slice(0, arrClose) + section + reuse.slice(arrClose);
fs.writeFileSync(reusePath, reuse);
console.log('wrote', results.length, 'files + registered');
console.log(ids.join(' '));
}

withCardsDataSnapshot({ baseDir: DATA_DIR, read: () => main() });
