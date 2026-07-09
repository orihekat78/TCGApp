#!/usr/bin/env node
/**
 * hybrid pipeline — finish (workflow 結果 → 出荷直前までの決定論部の一気通貫後半)。
 * 昇格元: .tmp/_hybrid_merge.cjs (hybrid-pilot-1 / batch2 実証済) + pilot 教訓の恒久化:
 *   ① compiledRest verbatim ゲート (agent が rest を改変したら棄却)
 *   ② twin 同文機械証明 (refused 行同文 + rest deep-equal) で同 DSL 展開
 *   ③ ability key 順 正規化 (id,type,scope,... — lint-listener 800字 forward-scan 前提)
 *   ④ shipped-idiom 決定論 lint (BUG-130 uid:'$pick' / BUG-032 on-hand selfOnly /
 *      BUG-123 hand・remove・deck pick kind / sceneSetState 短縮形 player 必須)
 *   ⑤ validate-specs → codegen --write → register → tsc → crosscheck
 *
 * 使い方:
 *   node scripts/hybrid/finish.cjs [--results .tmp/_hybrid_run/wf_results.json] [--dry] [--label "CARD PHASE hybrid-batchN"]
 * 残る手作業: probe test (gen-card-probes.cjs 参照) / 意味等価 lens / full gates / commit。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const TMP = path.join(ROOT, '.tmp');
const RUN = path.join(TMP, '_hybrid_run');
const { compileCard } = require(path.join(ROOT, 'scripts', 'compiler', 'compile.cjs'));
const { loadProductions } = require(path.join(ROOT, 'scripts', 'compiler', 'productions.cjs'));
const { splitLines } = require(path.join(ROOT, 'scripts', 'compiler', 'norm.cjs'));

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const resultsPath = opt('--results', path.join(RUN, 'wf_results.json'));
const label = opt('--label', 'CARD PHASE hybrid batch');

const corpus = JSON.parse(fs.readFileSync(path.join(TMP, 'compiler', 'corpus.json'), 'utf8')).cards;
const byId = new Map(corpus.map((c) => [c.id, c]));
const productions = loadProductions();
const wf = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const results = wf.results || wf;

const strip = (a) => { const { id: _i, description: _d, ...rest } = a; return rest; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normTxt = (t) => (t || '').replace(/\s+/g, '');

// ── ③ key 順 正規化 (ability top-level のみ。effect 内部は触らない) ──
const KEY_ORDER = ['id', 'type', 'scope', 'trigger', 'condition', 'limit', 'cost', 'continuousModifier', 'effect', 'description', 'ruleRefs'];
function canonAbility(a) {
  const out = {};
  for (const k of KEY_ORDER) if (k in a) out[k] = a[k];
  for (const k of Object.keys(a)) if (!(k in out)) out[k] = a[k];
  return out;
}

// ── ④ shipped-idiom 決定論 lint (spec JSON 上の再帰 walk) ──
function idiomLint(rep, abilities) {
  const errs = [];
  const walk = (node, p) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    // BUG-130: rider = 「$pick を参照するが自前の target を持たない node」(前段 pick の bind に依存)。
    // uid:'$pick' + 自前 target の standalone atom は shipped 正準形 (D01012 ほか 149 files) → WARN。
    // ⚠ /\$pick/ 単純 match は $picked (別 bind) に誤爆する — 完全 token で判定 (batch6 B07054 で実踏)。
    if (node.uid === '$pick' && node.target) {
      errs.push(`${p}: WARN uid:'$pick'+target standalone (shipped 正準形、許容)`);
    } else if (!node.target && typeof node === 'object') {
      for (const v of Object.values(node)) {
        if (v === '$pick') { errs.push(`${p}: BUG-130 orphan '$pick' 参照 (自前 target 無し — 前段 pick bind 依存の rider は短縮形/bind 明示に)`); break; }
      }
    }
    // BUG-123: hand/remove/deck からの pick で「キャラ」対象なのに kind 無しは検出不能 (印字参照要) — kind 無し自体を warn
    if (node.kind === 'pick' && node.query && ['hand', 'remove', 'deck'].includes(node.query.area) && node.query.filter && !node.query.filter.kind) {
      errs.push(`${p}: WARN BUG-123 ${node.query.area}-pick filter に kind 無し (キャラ対象なら kind:'character' 必須)`);
    }
    // sceneSetState 短縮形は player 必須 (uid 直指定を除く)
    if (node.verb === 'sceneSetState' && node.args && !node.args.uid && !node.args.player) {
      errs.push(`${p}: sceneSetState 短縮形に player 無し (silent no-op、reference-scenesetstate-shortform-player-required)`);
    }
    for (const k of Object.keys(node)) walk(node[k], `${p}.${k}`);
  };
  let abilityJson = '';
  abilities.forEach((a, i) => {
    // BUG-032: on-hand triggered は selfOnly 必須
    if (a.scope === 'on-hand' && a.type === 'triggered' && a.trigger && a.trigger.selfOnly !== true) {
      errs.push(`a${i + 1}: BUG-032 on-hand triggered に selfOnly:true 無し`);
    }
    abilityJson = JSON.stringify(a);
    walk(a, `a${i + 1}`);
  });
  return errs.map((e) => `${rep}: ${e}`);
}

// ── ①② merge (pilot 実証ロジック) ──
const specs = [];
const report = [];
const idiomFindings = [];
for (const r of results) {
  const id = r.id;
  const payload = JSON.parse(fs.readFileSync(path.join(RUN, 'payloads', id + '.json'), 'utf8'));
  if (!r.author || r.author.verdict !== 'FEASIBLE') { report.push({ id, status: 'DEFER', reason: (r.author && r.author.deferReason) || 'agent-null' }); continue; }
  if (!r.verify || r.verify.verdict !== 'EQUIVALENT') { report.push({ id, status: 'VERIFY_FAIL', issues: r.verify && r.verify.issues }); continue; }
  const novelIdx = new Set(r.author.novelIndexes || []);
  const restOut = r.author.abilities.filter((_, i) => !novelIdx.has(i)).map(strip);
  const restCompiled = (payload.compiledRest.abilities || []).map(strip);
  if (!deepEq(restOut, restCompiled)) { report.push({ id, status: 'REST_MUTATED', note: 'compiledRest 改変検出 — agent 出力棄却' }); continue; }
  const kwOut = (r.author.keywords || []).slice().sort();
  const kwCompiled = (payload.compiledRest.keywords || []).slice().sort();
  if (!deepEq(kwOut, kwCompiled) && kwCompiled.length) { report.push({ id, status: 'KW_MUTATED', got: kwOut, want: kwCompiled }); continue; }
  const abilities = r.author.abilities.map((a, i) => canonAbility({ ...a, id: 'a' + (i + 1) }));
  const lintErrs = idiomLint(id, abilities);
  idiomFindings.push(...lintErrs);
  const mk = (rep) => ({ rep, verdict: 'green', confidence: 'hybrid', tier: 'T1', keywords: r.author.keywords || [], abilities, ruleRefs: r.author.ruleRefs || [], cluster: label });
  specs.push(mk(id));
  const twinsOk = [];
  const twinsFail = [];
  // 正準 = refusedLines (1〜N 行)。旧 payload (refusedLine 単数) も受ける
  const baseRefused = payload.refusedLines || [payload.refusedLine];
  const baseKey = baseRefused.map((x) => normTxt(x.text)).sort().join('||');
  for (const t of (payload.unit.twins || [])) {
    const te = byId.get(t);
    if (!te) { twinsFail.push({ t, why: 'no-corpus' }); continue; }
    const tr = compileCard(te, productions);
    if (tr.status !== 'refused' || tr.refusals.length !== baseRefused.length) { twinsFail.push({ t, why: 'refusal-shape' }); continue; }
    const tKey = tr.refusals.map((x) => normTxt(x.text)).sort().join('||');
    if (tKey !== baseKey) { twinsFail.push({ t, why: 'refused-text-differs' }); continue; }
    const texts2 = { ...te.texts };
    for (const ref of tr.refusals) {
      texts2[ref.col] = splitLines(texts2[ref.col]).filter((l) => l !== ref.text).join('\\n');
    }
    const tr2 = compileCard({ ...te, texts: texts2 }, productions);
    const tRest = tr2.status === 'compiled' ? tr2.abilities.map(strip) : null;
    if (!tRest || !deepEq(tRest, restCompiled)) { twinsFail.push({ t, why: 'rest-differs' }); continue; }
    specs.push(mk(t));
    twinsOk.push(t);
  }
  report.push({ id, status: 'GREEN', twins: twinsOk, twinsFail: twinsFail.length ? twinsFail : undefined });
}

const specsPath = path.join(RUN, 'specs.json');
fs.writeFileSync(specsPath, JSON.stringify(specs, null, 1));
console.log(JSON.stringify(report, null, 1));
if (idiomFindings.length) {
  console.log('\n[finish] ⚠ shipped-idiom lint findings (WARN 以外は要修正):');
  idiomFindings.forEach((e) => console.log('  - ' + e));
  if (idiomFindings.some((e) => !e.includes('WARN'))) {
    console.log('[finish] hard idiom violation あり — codegen 中断');
    process.exit(1);
  }
}
console.log(`\n[finish] specs: ${specs.length} -> ${specsPath}`);
if (flag('--dry')) { console.log('[finish] --dry: codegen/register スキップ'); process.exit(0); }

// ── ⑤ 決定論ゲート → codegen → register ──
const sh = (cmd) => { console.log(`\n[finish] $ ${cmd}`); execSync(cmd, { cwd: ROOT, stdio: 'inherit' }); };
sh(`node scripts/taskA-validate-specs.cjs ${path.relative(ROOT, specsPath)}`);
sh(`node scripts/taskA-codegen.cjs ${path.relative(ROOT, specsPath)} --write`);
// register 入力は .tmp-taskA-registered.json 固定 (taskA-register.cjs 規約)
const regList = specs.map((s) => ({ id: s.rep, pkg: (byId.get(s.rep) || {}).pkg }));
fs.writeFileSync(path.join(ROOT, '.tmp-taskA-registered.json'), JSON.stringify(regList, null, 1));
sh(`node scripts/taskA-register.cjs "${label}"`);
sh('npx tsc --noEmit');
sh('node scripts/card-text-crosscheck.cjs');
console.log('\n[finish] 決定論部 完了。残 = probe (scripts/gen-card-probes.cjs) → 意味等価 lens → full gates → commit');
