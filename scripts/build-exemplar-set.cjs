const fs = require('fs');
const path = require('path');
const { fingerprint } = require('./card-fingerprint.cjs');

function buildExemplarSet(shipped) {
  const tokens = new Set();
  const skeletons = new Set();
  for (const c of shipped) {
    const fp = fingerprint(c.abilities);
    fp.tokens.forEach((t) => tokens.add(t));
    skeletons.add(fp.skeletonHash);
  }
  return { tokens: [...tokens].sort(), skeletons: [...skeletons], cards: shipped.length };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const shipped = JSON.parse(fs.readFileSync(path.join(root, '.tmp/card-factory/shipped-abilities.json'), 'utf8'));
  const e = buildExemplarSet(shipped);
  fs.writeFileSync(path.join(root, '.tmp/card-factory/exemplar-set.json'), JSON.stringify(e, null, 1));
  console.log(`exemplar-set: ${e.cards} cards / ${e.tokens.length} tokens / ${e.skeletons.length} skeletons`);
}
module.exports = { buildExemplarSet };
