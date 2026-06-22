/**
 * verify-clone-identity の結果 (.tmp/clone-verify.json) と certify verdict (.tmp/certify/<rep>.json) から
 * codegen 入力 (.tmp/taskA/greens-for-codegen.json) を構築する。
 *
 * collect-greens.cjs の自動 clone 展開は lossy-signature の cloneTargets を無検証採用するため使わない。
 * ここでは **byte 同一性検証を通った clone のみ** を rep spec の複製として展開する。
 *
 * 各 spec の再ガード: verdict==='green' / verify.ok / fatal 0 / !needsManual / 未実装。
 * 使い方: node scripts/survey/build-verified-codegen-input.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CERT = path.join(ROOT, '.tmp/certify');

const cv = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/clone-verify.json'), 'utf8'));

const implemented = new Set();
for (const d of fs.readdirSync(path.join(ROOT, 'src', 'cards'))) {
  const dir = path.join(ROOT, 'src', 'cards', d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) implemented.add(f.replace(/\.ts$/, ''));
}

const out = [];
const rows = [];
for (const a of cv.adopt) {
  const rep = a.rep;
  const specPath = path.join(CERT, `${rep}.json`);
  if (!fs.existsSync(specPath)) { rows.push({ rep, status: 'NO-SPEC' }); continue; }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  if (spec.rep !== rep) { rows.push({ rep, status: 'rep-mismatch' }); continue; }
  if (spec.verdict !== 'green') { rows.push({ rep, status: 'not-green' }); continue; }
  if (spec.needsManual) { rows.push({ rep, status: 'needsManual' }); continue; }
  const vp = path.join(CERT, `${rep}.verify.json`);
  if (!fs.existsSync(vp)) { rows.push({ rep, status: 'unverified' }); continue; }
  const verify = JSON.parse(fs.readFileSync(vp, 'utf8'));
  const fatals = (verify.problems || []).filter((p) => p.severity === 'fatal');
  if (!verify.ok || fatals.length) { rows.push({ rep, status: 'refuted', fatals: fatals.length }); continue; }
  if (implemented.has(rep)) { rows.push({ rep, status: 'already-implemented' }); continue; }
  out.push(spec);
  rows.push({ rep, status: 'ADOPT', tier: spec.tier, clones: a.fromClones.length });
  for (const cl of a.fromClones) {
    if (implemented.has(cl)) { rows.push({ rep: cl, status: 'clone-already-impl' }); continue; }
    out.push({ ...spec, rep: cl, notes: `${spec.notes || ''} [clone of ${rep} — byte-identical text verified]`.trim() });
    rows.push({ rep: cl, status: 'ADOPT-clone', of: rep });
  }
}

// DEFER ガード: 過去に DEFERRED-INDEX へ理由付きで保留したカードを certify が green 再判定した場合、
// 黙って出荷せず surface する (B07098: count-dyn 不在で defer → forEach-over-all で解禁、要人手裁定)。
const deferIdxPath = path.join(ROOT, '.claude/specs/DEFERRED-INDEX.md');
if (fs.existsSync(deferIdxPath)) {
  const deferText = fs.readFileSync(deferIdxPath, 'utf8');
  const deferHits = out.map((s) => s.rep).filter((id) => new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(deferText));
  if (deferHits.length) {
    console.log(`\n⚠️  DEFER-ADJUDICATION REQUIRED: 以下は DEFERRED-INDEX 記載カード。certify が解禁を主張している。`);
    console.log(`   解禁が正当なら DEFERRED-INDEX から除去、不当なら本バッチから除外せよ: ${[...new Set(deferHits)].join(', ')}\n`);
  }
}

fs.writeFileSync(path.join(ROOT, '.tmp/taskA/greens-for-codegen.json'), JSON.stringify(out, null, 1));
const counts = rows.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
console.log(JSON.stringify(counts, null, 1));
for (const r of rows.filter((x) => !['ADOPT', 'ADOPT-clone'].includes(x.status))) console.log('SKIP', JSON.stringify(r));
console.log(`codegen input: ${out.length} specs -> .tmp/taskA/greens-for-codegen.json`);
