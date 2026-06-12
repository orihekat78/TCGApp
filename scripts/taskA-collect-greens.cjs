/**
 * Task A — certify 出力の集約 + clone 展開。
 * .tmp/certify/*.json (spec) と *.verify.json を突合し:
 *   - green && !needsManual && verify.ok && fatal 0 → 採用
 *   - 採用 spec の cloneTargets (certify-queue) へ spec 複製 (rep 差し替え)
 * 出力: .tmp/taskA/greens-for-codegen.json (codegen 入力) + サマリ
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CERT = path.join(ROOT, '.tmp/certify');
const q = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/taskA/certify-queue.json'), 'utf8'));
const cloneMap = new Map(q.items.map((it) => [it.rep, it.cloneTargets || []]));

// 手動 DEFER リスト (.tmp/taskA/defer.json = [rep,...]) — adversarial verify pass でも人手で保留したカード。
const deferPath = path.join(ROOT, '.tmp/taskA/defer.json');
const deferSet = new Set(fs.existsSync(deferPath) ? JSON.parse(fs.readFileSync(deferPath, 'utf8')) : []);

const fileSet = new Set();
for (const d of fs.readdirSync(path.join(ROOT, 'src', 'cards'))) {
  const dir = path.join(ROOT, 'src', 'cards', d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) fileSet.add(f.replace(/\.ts$/, ''));
}

const out = [];
const rows = [];
for (const f of fs.readdirSync(CERT)) {
  if (!f.endsWith('.json') || f.endsWith('.verify.json')) continue;
  const rep = f.replace(/\.json$/, '');
  let spec;
  try { spec = JSON.parse(fs.readFileSync(path.join(CERT, f), 'utf8')); }
  catch (e) { rows.push({ rep, status: 'parse-fail' }); continue; }
  if (spec.rep !== rep) { rows.push({ rep, status: 'rep-mismatch', specRep: spec.rep }); continue; }
  if (spec.verdict !== 'green') { rows.push({ rep, status: 'yellow', blocker: spec.blocker }); continue; }
  if (deferSet.has(rep)) { rows.push({ rep, status: 'deferred' }); continue; }
  if (spec.needsManual) { rows.push({ rep, status: 'needsManual', reason: spec.manualReason }); continue; }
  const vp = path.join(CERT, `${rep}.verify.json`);
  if (!fs.existsSync(vp)) { rows.push({ rep, status: 'green-unverified' }); continue; }
  let verify;
  try { verify = JSON.parse(fs.readFileSync(vp, 'utf8')); }
  catch (e) { rows.push({ rep, status: 'verify-parse-fail' }); continue; }
  const fatals = (verify.problems || []).filter((p) => p.severity === 'fatal');
  if (!verify.ok || fatals.length) { rows.push({ rep, status: 'refuted', fatals: fatals.map((p) => p.issue).slice(0, 3) }); continue; }
  if (fileSet.has(rep)) { rows.push({ rep, status: 'already-implemented' }); continue; }
  out.push(spec);
  rows.push({ rep, status: 'ADOPT', tier: spec.tier });
  for (const cl of cloneMap.get(rep) || []) {
    if (fileSet.has(cl)) continue;
    out.push({ ...spec, rep: cl, notes: `${spec.notes || ''} [clone of ${rep} — 同テキスト member]`.trim() });
    rows.push({ rep: cl, status: 'ADOPT-clone', of: rep, tier: spec.tier });
  }
}

fs.writeFileSync(path.join(ROOT, '.tmp/taskA/greens-for-codegen.json'), JSON.stringify(out, null, 1));
const counts = rows.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
console.log(JSON.stringify(counts, null, 1));
for (const r of rows.filter((x) => ['refuted', 'needsManual', 'rep-mismatch', 'parse-fail', 'verify-parse-fail', 'green-unverified'].includes(x.status))) {
  console.log(JSON.stringify(r));
}
console.log(`codegen input: ${out.length} specs -> .tmp/taskA/greens-for-codegen.json`);
