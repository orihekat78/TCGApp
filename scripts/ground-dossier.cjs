#!/usr/bin/env node
// ground-dossier.cjs — grounding の機械前処理 (2026-07-10 token 削減施策 #2)
//
// grounding agent が token を費やしていた「探す」工程 (TSV 行 / 登録判定 / DEFER 行 /
// engine capability の存在確認) を決定論で一括出力する。agent には本 dossier を Read させ、
// 判断 (印字 ⇔ DSL 意味突合・設計) だけをさせる。
//
// 使い方:
//   node scripts/ground-dossier.cjs B01022 B02072 ...
//   → .tmp/_ground/<ID>.md に per-ID dossier / .tmp/_ground/_capabilities.md に snapshot
//   → stdout に要約
//
// capability snapshot は毎回 fresh に再生成 (capability-map.txt の stale 教訓
// [reference-capability-map-stale-negatives] — 実ファイル直 parse のみ、キャッシュしない)。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.tmp', '_ground');
fs.mkdirSync(OUT, { recursive: true });

const ids = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (ids.length === 0) {
  console.error('usage: node scripts/ground-dossier.cjs <ID> [<ID> ...]');
  process.exit(1);
}

function read(p) { return fs.readFileSync(p, 'utf8'); }
function tryRead(p) { try { return read(p); } catch { return null; } }
function listFiles(dir, pred, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

// ── capability snapshot (全 ID 共通、fresh parse) ─────────────────────────────
function capabilities() {
  const lines = ['# engine capability snapshot (ground-dossier 自動生成 — 実ファイル直 parse、stale 無し)', ''];

  // AtomVerb union
  const typesSrc = read(path.join(ROOT, 'src/engine/types/effect.ts'));
  const avm = typesSrc.match(/export type AtomVerb =([\s\S]*?);/);
  const verbs = avm ? [...avm[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
  lines.push(`## AtomVerb (${verbs.length}) — src/engine/types/effect.ts`, verbs.join(' / '), '');

  // Condition kinds (CONDITION_KIND_MAP)
  const condSrc = read(path.join(ROOT, 'src/engine/cond/eval.ts'));
  const ckm = condSrc.match(/CONDITION_KIND_MAP[^=]*=\s*\{([\s\S]*?)\n\}/);
  const conds = ckm ? [...ckm[1].matchAll(/^\s*([A-Za-z0-9_]+):\s*true/gm)].map(m => m[1]) : [];
  lines.push(`## Condition kinds (${conds.length}) — src/engine/cond/eval.ts CONDITION_KIND_MAP`, conds.join(' / '), '');

  // Cost kinds (Cost union の kind リテラル)。object literal member の ';' で止まらないよう
  // 次の export 宣言までを span にする。
  const costm = typesSrc.match(/export type Cost =([\s\S]*?)(?=\nexport )/);
  const costs = costm ? [...new Set([...costm[1].matchAll(/kind:\s*'([^']+)'/g)].map(m => m[1]))] : [];
  lines.push(`## Cost kinds (${costs.length}) — src/engine/types/effect.ts Cost union`, costs.join(' / '), '');

  // dyn props ($self.X / resolveBound fields)
  const dynSrc = read(path.join(ROOT, 'src/engine/dyn/eval.ts'));
  const props = [...new Set([...dynSrc.matchAll(/prop === '([A-Za-z0-9_]+)'/g)].map(m => m[1]))];
  const boundFields = [...new Set([...dynSrc.matchAll(/case '([A-Za-z0-9_]+)':/g)].map(m => m[1]))];
  lines.push(`## dyn props ($self.* 系、${props.length}) — src/engine/dyn/eval.ts`, props.join(' / '), '');
  lines.push(`## dyn bound fields ($bound.<key>.* 候補含む case ラベル、${boundFields.length})`, boundFields.join(' / '), '');

  // TargetFilter / TargetQuery fields
  for (const tname of ['TargetFilter', 'TargetQuery']) {
    const tm = typesSrc.match(new RegExp(`export type ${tname} = \\{([\\s\\S]*?)\\n\\};`));
    const fields = tm ? [...tm[1].matchAll(/^\s{2}([A-Za-z0-9_]+)\??:/gm)].map(m => m[1]) : [];
    lines.push(`## ${tname} fields (${fields.length})`, fields.join(' / '), '');
  }

  // trigger hooks (listeners が emit / 参照する hook 名の実測: src/engine grep)
  const hookSet = new Set();
  for (const f of listFiles(path.join(ROOT, 'src/engine'), p => p.endsWith('.ts'))) {
    const s = tryRead(f) || '';
    for (const m of s.matchAll(/event\.emit\(\s*[a-zA-Z]+,\s*'([^']+)'/g)) hookSet.add(m[1]);
  }
  lines.push(`## emit される hook (${hookSet.size}) — src/engine 全 grep`, [...hookSet].sort().join(' / '), '');

  lines.push('※ 各項目の意味・条件は該当ファイルを直接 Read して確認すること (本 snapshot は存在確認用)。');
  return lines.join('\n');
}

// ── per-ID dossier ────────────────────────────────────────────────────────────
const tsvFiles = listFiles(path.join(ROOT, '.claude/specs/cards-data'), p => p.endsWith('.tsv'));
const cardFiles = listFiles(path.join(ROOT, 'src/cards'), p => p.endsWith('.ts'));
const reuseIdx = read(path.join(ROOT, 'src/cards/_reuse/index.ts'));
const defIdx = read(path.join(ROOT, '.claude/specs/DEFERRED-INDEX.md'));

function dossier(id) {
  const out = [`# grounding dossier: ${id} (自動生成 ${new Date().toISOString().slice(0, 10)})`, ''];

  // 1. TSV 行 (ID 完全一致列を持つ行。P variant も同時列挙)
  out.push('## TSV (印字 ground truth)');
  let tsvHit = 0;
  for (const f of tsvFiles) {
    const rel = path.relative(ROOT, f);
    for (const line of read(f).split('\n')) {
      const cols = line.split('\t');
      if (cols.some(c => c === id || c === id + 'P' || c === id + 'P2')) {
        out.push(`- ${rel}:`, '```', line.trim(), '```');
        tsvHit++;
      }
    }
  }
  if (!tsvHit) out.push('- **TSV に見つからない** (ID 誤記 or 未収載)');
  out.push('');

  // 2. 登録状態
  out.push('## 登録状態 (src/cards 実測)');
  const defFiles = cardFiles.filter(f => {
    const s = read(f);
    return new RegExp(`export const ${id}(P|P2)?:\\s*CardDef`).test(s);
  });
  if (defFiles.length === 0) out.push('- CardDef 定義: **無し (未実装)**');
  for (const f of defFiles) {
    const rel = path.relative(ROOT, f);
    const s = read(f);
    const deferred = [...s.matchAll(/^.*DEFERRED.*$/gm)].map(m => m[0].trim());
    out.push(`- CardDef あり: ${rel}${deferred.length ? ` — ⚠ DEFERRED コメント ${deferred.length} 件:` : ''}`);
    for (const d of deferred) out.push(`  - ${d}`);
  }
  const inReuse = [id, id + 'P', id + 'P2'].filter(v => new RegExp(`\\b${v}\\b`).test(reuseIdx));
  out.push(`- _reuse/index.ts 登録: ${inReuse.length ? inReuse.join(', ') : '無し'}`);
  out.push('');

  // 3. DEFERRED-INDEX 該当行
  out.push('## DEFERRED-INDEX 該当行 (⚠ blocker 記述は stale 化しうる — 必ず現行 code で再検証)');
  const defLines = defIdx.split('\n').filter(l => l.includes(id));
  if (defLines.length === 0) out.push('- 記載なし');
  for (const l of defLines) out.push(`- ${l.trim()}`);
  out.push('');

  // 4. 既存 grounding dossier (過去 session の判断部分)
  const prior = tryRead(path.join(ROOT, '.claude/specs/grounding', `${id}.md`));
  out.push('## 過去 grounding (specs/grounding/)');
  out.push(prior ? `- **あり** → .claude/specs/grounding/${id}.md を Read (再調査不要な可能性)` : '- なし');
  out.push('');

  out.push('## capability snapshot', '- .tmp/_ground/_capabilities.md を Read (verb/cond/dyn/cost/hook の存在一覧)');
  return out.join('\n');
}

fs.writeFileSync(path.join(OUT, '_capabilities.md'), capabilities());
console.log(`[ground-dossier] capabilities → .tmp/_ground/_capabilities.md`);
for (const id of ids) {
  const d = dossier(id);
  fs.writeFileSync(path.join(OUT, `${id}.md`), d);
  const reg = d.includes('CardDef あり') ? 'REGISTERED' : 'unregistered';
  const defc = (d.match(/^- \|/gm) || []).length;
  console.log(`[ground-dossier] ${id} → .tmp/_ground/${id}.md (${reg}, DEFER 行 ${defc})`);
}
