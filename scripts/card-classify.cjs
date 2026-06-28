const fs = require('fs');
const path = require('path');
const { fingerprint } = require('./card-fingerprint.cjs');

function classify(abilities, exemplar) {
  const fp = fingerprint(abilities);
  if (fp.tokens.includes('closure')) return { tier: 'T2', reason: 'closure' };
  const tset = new Set(exemplar.tokens || []);
  const novel = fp.tokens.filter((t) => !tset.has(t));
  if (novel.length) return { tier: 'T2', reason: 'novel-token', novel };
  if (new Set(exemplar.skeletons || []).has(fp.skeletonHash)) return { tier: 'T0' };
  return { tier: 'T1' };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const exemplar = JSON.parse(fs.readFileSync(path.join(root, '.tmp/card-factory/exemplar-set.json'), 'utf8'));
  const target = process.argv[2];
  let specs = [];
  if (fs.statSync(target).isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (!f.endsWith('.json') || f.endsWith('.verify.json')) continue;
      try { specs.push(JSON.parse(fs.readFileSync(path.join(target, f), 'utf8'))); } catch (e) {}
    }
  } else { specs = JSON.parse(fs.readFileSync(target, 'utf8')); }
  const counts = { T0: 0, T1: 0, T2: 0 };
  for (const s of specs) {
    if (s.verdict && s.verdict !== 'green') continue;
    const r = classify(s.abilities || [], exemplar);
    counts[r.tier]++;
    console.log(`${r.tier}\t${s.rep || '?'}\t${r.reason || ''}${r.novel ? ' ' + r.novel.join(',') : ''}`);
  }
  console.log(`\nT0=${counts.T0} T1=${counts.T1} T2=${counts.T2} / ${specs.length}`);
}
module.exports = { classify };
