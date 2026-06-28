const fs = require('fs');
const path = require('path');
const { fingerprint } = require('./card-fingerprint.cjs');

// shipped = runtime ALL_CARDS abilities ([{id, abilities}])。
// specs   = 出荷済カードの spec-form corpus ([{id, abilities}])。codegen 前 annotation
//           (__shared / __eventUse 等) を保持するため、runtime exemplar に無い token/skeleton を補う。
//           これが無いと shared-class / eventUse 候補が false-T2 (novel-token) になる (回帰テスト参照)。
function buildExemplarSet(shipped, specs = []) {
  const tokens = new Set();
  const skeletons = new Set();
  for (const c of [...shipped, ...(specs || [])]) {
    const fp = fingerprint(c.abilities);
    fp.tokens.forEach((t) => tokens.add(t));
    skeletons.add(fp.skeletonHash);
  }
  return { tokens: [...tokens].sort(), skeletons: [...skeletons], cards: shipped.length, specs: (specs || []).length };
}

// 出荷済 rep の grounded spec を corpus として収集 (.tmp/certify/*.json + _wave-novel-specs.json)。
// 純度: shipped id 集合に含まれる rep のみ (= 出荷済カードの spec のみ exemplar 化)。
function loadSpecCorpus(root, shippedIds) {
  const out = [];
  const seen = new Set();
  const push = (rep, abilities) => {
    if (!rep || seen.has(rep) || !shippedIds.has(rep) || !Array.isArray(abilities)) return;
    seen.add(rep); out.push({ id: rep, abilities });
  };
  const certDir = path.join(root, '.tmp/certify');
  if (fs.existsSync(certDir)) {
    for (const f of fs.readdirSync(certDir)) {
      if (!f.endsWith('.json') || f.endsWith('.verify.json')) continue;
      try { const s = JSON.parse(fs.readFileSync(path.join(certDir, f), 'utf8')); push(s.rep, s.abilities); } catch (e) {}
    }
  }
  for (const rel of ['.tmp/_wave-novel-specs.json', '.tmp/taskA/_wave-novel-specs.json']) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    try { for (const s of JSON.parse(fs.readFileSync(p, 'utf8'))) push(s.rep, s.abilities); } catch (e) {}
  }
  return out;
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const shipped = JSON.parse(fs.readFileSync(path.join(root, '.tmp/card-factory/shipped-abilities.json'), 'utf8'));
  const shippedIds = new Set(shipped.map((c) => c.id));
  const corpus = loadSpecCorpus(root, shippedIds);
  const e = buildExemplarSet(shipped, corpus);
  fs.writeFileSync(path.join(root, '.tmp/card-factory/exemplar-set.json'), JSON.stringify(e, null, 1));
  console.log(`exemplar-set: ${e.cards} cards + ${e.specs} spec-corpus / ${e.tokens.length} tokens / ${e.skeletons.length} skeletons`);
}
module.exports = { buildExemplarSet, loadSpecCorpus };
