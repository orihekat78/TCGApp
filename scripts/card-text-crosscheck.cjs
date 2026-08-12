const fs = require('fs');
const path = require('path');
const { withCardsDataSnapshot } = require('./cards/official-api.cjs');

function extractLiterals(text) {
  if (!text) return [];
  const out = new Set();
  const add = (re, g) => { for (const m of text.matchAll(re)) out.add(m[g]); };
  add(/【(赤|青|黄|緑|黒|白)】/g, 1); add(/特徴[\[「]([^\]」]+)[\]」]/g, 1);
  add(/カード名[\[「]([^\]」]+)[\]」]/g, 1); add(/《([^》]+)》/g, 1);
  add(/(\d{3,})/g, 1); add(/(\d+)\s*枚/g, 1);          // AP/LP(1000+), 枚数
  add(/レベル(\d+)/g, 1); add(/(\d+)\s*以[下上]/g, 1); // レベル, 閾値
  return [...out];
}

function crosscheck(abilities, texts) {
  const blob = JSON.stringify(abilities);
  const lits = [...new Set(texts.flatMap((t) => extractLiterals(t)))];
  const missing = lits.filter((l) => !blob.includes(l));
  return { ok: missing.length === 0, missing };
}

function cardsDataDir() {
  return path.resolve(process.env.CONAN_CARDS_DATA_DIR || path.join(__dirname, '..', '.claude', 'specs', 'cards-data'));
}

function loadTsv(root = cardsDataDir()) {
  const rows = {};
  for (const pkg of fs.readdirSync(root)) {
    const dir = path.join(root, pkg);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.tsv')) continue;
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter((l) => l.trim());
      const hdr = lines[0].split('\t'); const I = (n) => hdr.indexOf(n);
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split('\t');
        rows[(c[0] || '').trim()] = ['effect', 'cutIn', 'hirameki', 'henso'].map((k) => (I(k) >= 0 ? (c[I(k)] || '').trim() : ''));
      }
    }
  }
  return rows;
}

if (require.main === module) {
  const baseDir = cardsDataDir();
  const rows = withCardsDataSnapshot({ baseDir, read: () => loadTsv(baseDir) });
  const cands = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.tmp/card-factory/t0-abilities.json'), 'utf8'));
  let fail = 0;
  for (const c of cands) {
    const r = crosscheck(c.abilities, rows[c.id] || []);
    if (!r.ok) { fail++; console.log(`FAIL ${c.id}: missing ${r.missing.join(', ')}`); }
  }
  console.log(`crosscheck: ${cands.length - fail}/${cands.length} ok`);
  process.exit(fail ? 1 : 0);
}
module.exports = { cardsDataDir, extractLiterals, crosscheck, loadTsv };
