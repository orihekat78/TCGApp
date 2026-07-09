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
const MAX_REFUSALS = Number(opt('--max-refusals', '1')); // 2 で refuse-2行 pool (125枚規模) も pipeline に乗せる
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
const restOf = new Map(); // id -> {refusedLines, refusedKey, restJson} (twin key 素材)
const normTxt = (t) => (t || '').replace(/\s+/g, '');
const strip = (a) => { const { id: _i, description: _d, ...rest } = a; return rest; };
// 全 refused 行を各 col から除去して rest を compile (1行/2行 共通)
function compileRest(e, refusals) {
  const texts2 = { ...e.texts };
  for (const ref of refusals) {
    texts2[ref.col] = splitLines(texts2[ref.col]).filter((l) => l !== ref.text).join('\\n');
  }
  return compileCard({ ...e, texts: texts2 }, productions);
}
for (const e of realBases) {
  const r = compileCard(e, productions);
  if (r.status === 'compiled') { stats.compiled.push(e.id); continue; }
  if (r.refusals.some((x) => x.col === '*')) { stats.entryRefused.push({ id: e.id, reason: r.refusals[0].reason }); continue; }
  const rec = { id: e.id, name: e.title || '', kind: e.kind, refusals: r.refusals.map((x) => ({ col: x.col, text: x.text })) };
  if (r.refusals.length === 1) stats.oneLine.push(rec);
  else if (r.refusals.length === 2) stats.twoLine.push(rec);
  else stats.moreLine.push(rec);
  if (r.refusals.length >= 1 && r.refusals.length <= MAX_REFUSALS) {
    const refusedLines = r.refusals.map((x) => ({ col: x.col, text: x.text }));
    const r2 = compileRest(e, refusedLines);
    restOf.set(e.id, {
      refusedLines,
      // twin key = refused 行の正規化テキスト集合 (順序不問) — finish の機械証明と同条件
      refusedKey: refusedLines.map((x) => normTxt(x.text)).sort().join('||'),
      restJson: r2.status === 'compiled' ? JSON.stringify(r2.abilities.map(strip)) : null,
      compiledRest: r2.status === 'compiled' ? { abilities: r2.abilities, keywords: r2.keywords } : { error: 'rest-not-compiled', refusals: r2.refusals },
    });
  }
}
fs.writeFileSync(path.join(TMP, '_hybrid_refuse1.json'), JSON.stringify({
  totalUnshippedBases: realBases.length, compiled: stats.compiled.length, entryRefused: stats.entryRefused.length,
  oneLine: stats.oneLine.length, twoLine: stats.twoLine.length, moreLine: stats.moreLine.length,
  compiledIds: stats.compiled, oneLineCards: stats.oneLine,
}, null, 1));

// ── 3. twin 自動 group (refused 行集合 同文 + rest deep-equal。finish の機械証明と同条件) ──
// 1行 unit を先に (安い・歩留まり実証済)、次に 2行 unit — pool 順は refusals 数の昇順で安定させる
const groups = new Map(); // key -> {ids, nRefusals}
for (const rec of [...stats.oneLine, ...(MAX_REFUSALS >= 2 ? stats.twoLine : [])]) {
  const m = restOf.get(rec.id);
  if (!m) continue;
  const key = m.restJson === null ? `solo:${rec.id}` : `${m.refusedKey}::${m.restJson}`;
  if (!groups.has(key)) groups.set(key, { ids: [], nRefusals: rec.refusals.length });
  groups.get(key).ids.push(rec.id);
}

// ── 4. DEFERRED-INDEX 照合 (既 DEFER の再選定防止。ただし「出荷済」「解禁」行は除外しない) ──
const defIdx = fs.readFileSync(path.join(ROOT, '.claude', 'specs', 'DEFERRED-INDEX.md'), 'utf8');
const defLines = defIdx.split(/\r?\n/);
const deferListed = (id) => defLines.some((l) => l.includes(id) && !/出荷済|解禁済|✅|~~/.test(l));

// ── 5. 選定: refusals 数 昇順 → twin group 大きい順 → 単発。--reps 指定時はそれのみ ──
const units = [];
const skippedDeferred = [];
const candidates = [...groups.values()].sort((a, b) => (a.nRefusals - b.nRefusals) || (b.ids.length - a.ids.length));
for (const { ids: g, nRefusals } of candidates) {
  const rep = g[0];
  if (REPS && !g.some((id) => REPS.includes(id))) continue;
  if (!flag('--include-deferred') && deferListed(rep)) { skippedDeferred.push(g); continue; }
  units.push({ rep, twins: g.slice(1), nRefusals });
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
    // refusedLine = 後方互換 (1行時のみ)。正準は refusedLines (1〜MAX_REFUSALS 行)
    refusedLine: m.refusedLines.length === 1 ? m.refusedLines[0] : undefined,
    refusedLines: m.refusedLines,
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
  oneLineTotal: stats.oneLine.length, twoLineTotal: stats.twoLine.length, maxRefusals: MAX_REFUSALS,
  selectedUnits: units.length,
  selected1Line: units.filter((u) => u.nRefusals === 1).length,
  selected2Line: units.filter((u) => u.nRefusals === 2).length,
  selectedPrintings: units.reduce((s, u) => s + 1 + u.twins.length, 0),
  twinGroups: units.filter((u) => u.twins.length).length,
  skippedDeferred: skippedDeferred.length,
}, null, 1));
console.log(`[prepare] payloads -> ${payloadDir}`);
console.log('[prepare] 次工程: workflow (author opus / verify sonnet5、payload は agent に Read させる) の結果を');
console.log('          .tmp/_hybrid_run/wf_results.json に保存 → node scripts/hybrid/finish.cjs');
