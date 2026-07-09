#!/usr/bin/env node
/**
 * hybrid pipeline — prepare (選定 + payload 生成、決定論部の一気通貫前半)。
 * 昇格元: .tmp/_hybrid_refuse1.cjs + _hybrid_payload_gen.cjs (hybrid-pilot-1 / batch2 実証済)。
 * 改良: twin group を手書きせず自動導出 (refused 行 同文 + rest-compile deep-equal の機械証明と同条件)。
 *
 * 使い方:
 *   node scripts/hybrid/prepare.cjs [--n 35] [--reps B01051,B02062] [--include-deferred] [--skip-refresh]
 * 出力:
 *   .tmp/_hybrid_run/manifest.json   — units (rep+twins) / deferredListed / counts
 *   .tmp/_hybrid_run/payloads/<rep>.json — workflow agent が Read する per-unit payload
 *   .tmp/_hybrid_refuse1.json        — refuse 全景 (統計)
 * 次工程: workflow (author opus ×N / verify sonnet5 lens、chunk4) → scripts/hybrid/finish.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const TMP = path.join(ROOT, '.tmp');
const { compileCard } = require(path.join(ROOT, 'scripts', 'compiler', 'compile.cjs'));
const { loadProductions } = require(path.join(ROOT, 'scripts', 'compiler', 'productions.cjs'));
const { splitLines } = require(path.join(ROOT, 'scripts', 'compiler', 'norm.cjs'));

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const N = Number(opt('--n', '35'));
const REPS = opt('--reps', '') ? opt('--reps', '').split(',').map((s) => s.trim()).filter(Boolean) : null;

// ── 1. corpus / shipped-dsl を fresh 化 (stale 選定の再発防止) ──
if (!flag('--skip-refresh')) {
  console.log('[prepare] refreshing corpus + shipped-dsl ...');
  execSync('node scripts/compiler/tsv-corpus.cjs', { cwd: ROOT, stdio: 'inherit' });
  execSync('npx tsx scripts/compiler/dump-shipped.ts', { cwd: ROOT, stdio: 'inherit' });
}

const corpus = JSON.parse(fs.readFileSync(path.join(TMP, 'compiler', 'corpus.json'), 'utf8')).cards;
const shipped = JSON.parse(fs.readFileSync(path.join(TMP, 'compiler', 'shipped-dsl.json'), 'utf8'));
const shippedIds = new Set(shipped.cards.map((s) => s.id));
const productions = loadProductions();
const byId = new Map(corpus.map((c) => [c.id, c]));
const idSet = new Set(corpus.map((e) => e.id));
const isPVariant = (id) => { const m = id.match(/^(.+?)P\d*$/); return !!(m && idSet.has(m[1])); };

// ── 2. refuse-1行 全景 scan ──
const realBases = corpus.filter((e) => !shippedIds.has(e.id) && !isPVariant(e.id));
const stats = { compiled: [], oneLine: [], twoLine: [], moreLine: [], entryRefused: [] };
const restOf = new Map(); // id -> {refusedNorm, restJson} (twin key 素材)
const normTxt = (t) => (t || '').replace(/\s+/g, '');
const strip = (a) => { const { id: _i, description: _d, ...rest } = a; return rest; };
for (const e of realBases) {
  const r = compileCard(e, productions);
  if (r.status === 'compiled') { stats.compiled.push(e.id); continue; }
  if (r.refusals.some((x) => x.col === '*')) { stats.entryRefused.push({ id: e.id, reason: r.refusals[0].reason }); continue; }
  const rec = { id: e.id, name: e.title || '', kind: e.kind, refusals: r.refusals.map((x) => ({ col: x.col, text: x.text })) };
  if (r.refusals.length === 1) {
    stats.oneLine.push(rec);
    // rest compile (refused 行を除く) — twin 判定と payload の両方で使う
    const refused = r.refusals[0];
    const texts2 = { ...e.texts };
    texts2[refused.col] = splitLines(texts2[refused.col]).filter((l) => l !== refused.text).join('\\n');
    const r2 = compileCard({ ...e, texts: texts2 }, productions);
    restOf.set(e.id, {
      refused,
      refusedNorm: normTxt(refused.text),
      restJson: r2.status === 'compiled' ? JSON.stringify(r2.abilities.map(strip)) : null,
      compiledRest: r2.status === 'compiled' ? { abilities: r2.abilities, keywords: r2.keywords } : { error: 'rest-not-compiled', refusals: r2.refusals },
    });
  } else if (r.refusals.length === 2) stats.twoLine.push(rec);
  else stats.moreLine.push(rec);
}
fs.writeFileSync(path.join(TMP, '_hybrid_refuse1.json'), JSON.stringify({
  totalUnshippedBases: realBases.length, compiled: stats.compiled.length, entryRefused: stats.entryRefused.length,
  oneLine: stats.oneLine.length, twoLine: stats.twoLine.length, moreLine: stats.moreLine.length,
  compiledIds: stats.compiled, oneLineCards: stats.oneLine,
}, null, 1));

// ── 3. twin 自動 group (refused 行 同文 + rest deep-equal。finish の機械証明と同条件) ──
const groups = new Map(); // key -> [ids]
for (const rec of stats.oneLine) {
  const m = restOf.get(rec.id);
  const key = m.restJson === null ? `solo:${rec.id}` : `${m.refusedNorm}::${m.restJson}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(rec.id);
}

// ── 4. DEFERRED-INDEX 照合 (既 DEFER の再選定防止。ただし「出荷済」「解禁」行は除外しない) ──
const defIdx = fs.readFileSync(path.join(ROOT, '.claude', 'specs', 'DEFERRED-INDEX.md'), 'utf8');
const defLines = defIdx.split(/\r?\n/);
const deferListed = (id) => defLines.some((l) => l.includes(id) && !/出荷済|解禁済|✅|~~/.test(l));

// ── 5. 選定: twin group 大きい順 → 単発。--reps 指定時はそれのみ ──
const units = [];
const skippedDeferred = [];
const candidates = [...groups.values()].sort((a, b) => b.length - a.length);
for (const g of candidates) {
  const rep = g[0];
  if (REPS && !g.some((id) => REPS.includes(id))) continue;
  if (!flag('--include-deferred') && deferListed(rep)) { skippedDeferred.push(g); continue; }
  units.push({ rep, twins: g.slice(1) });
  if (!REPS && units.length >= N) break;
}

// ── 6. payload 生成 ──
const outDir = path.join(TMP, '_hybrid_run');
const payloadDir = path.join(outDir, 'payloads');
fs.mkdirSync(payloadDir, { recursive: true });
for (const u of units) {
  const e = byId.get(u.rep);
  const m = restOf.get(u.rep);
  const payload = {
    unit: u,
    card: { id: e.id, cardId: e.cardId, pkg: e.pkg, kind: e.kind, title: e.title, color: e.color, level: e.level, ap: e.ap, lp: e.lp, rarity: e.rarity, features: e.features },
    fullTexts: e.texts,
    qa: e.qa || '',
    refusedLine: { col: m.refused.col, text: m.refused.text },
    compiledRest: m.compiledRest,
    twinCards: u.twins.map((tid) => { const t = byId.get(tid); return { id: t.id, pkg: t.pkg, cardId: t.cardId, rarity: t.rarity, texts: t.texts, level: t.level, ap: t.ap, lp: t.lp, color: t.color, features: t.features, title: t.title }; }),
  };
  fs.writeFileSync(path.join(payloadDir, u.rep + '.json'), JSON.stringify(payload, null, 1));
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  generatedAt: null, // Date 不使用 (workflow resume 互換の慣行に合わせ手書き不要)
  n: units.length, printings: units.reduce((s, u) => s + 1 + u.twins.length, 0),
  units, skippedDeferred, oneLineTotal: stats.oneLine.length,
}, null, 1));

console.log(JSON.stringify({
  oneLineTotal: stats.oneLine.length, selectedUnits: units.length,
  selectedPrintings: units.reduce((s, u) => s + 1 + u.twins.length, 0),
  twinGroups: units.filter((u) => u.twins.length).length,
  skippedDeferred: skippedDeferred.length,
}, null, 1));
console.log(`[prepare] payloads -> ${payloadDir}`);
console.log('[prepare] 次工程: workflow (author opus / verify sonnet5、payload は agent に Read させる) の結果を');
console.log('          .tmp/_hybrid_run/wf_results.json に保存 → node scripts/hybrid/finish.cjs');
