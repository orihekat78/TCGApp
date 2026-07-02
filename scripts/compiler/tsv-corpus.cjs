// Track B compiler — B0 corpus 抽出。
// .claude/specs/cards-data/**/*.tsv → 全カード印字全列の正規化 JSON。
// grounding 原則: col10 effect だけでなく col11/12/13 (cutIn/hirameki/henso) を必ず含める
// (印字テキスト全列 ⇔ DSL 突合。ヒラメキ漏れの前科: B01075/B01089)。
// 使い方: node scripts/compiler/tsv-corpus.cjs  → .tmp/compiler/corpus.json
const fs = require('fs');
const path = require('path');

// kind ごとの TSV 列構成 (2026-07-02 実測):
//   character: cardNum cardId title color level ap lp rarity features imagePath effect cutIn hirameki henso illustrator flavor qAndA
//   event:     cardNum cardId title color level rarity imagePath effect cutIn hirameki illustrator flavor qAndA
//   partner:   cardNum cardId title color lp rarity features imagePath effect illustrator qAndA
//   case:      cardNum cardId title color rarity imagePath difficultyFirst difficultySecond effect illustrator qAndA
const TEXT_COLS = ['effect', 'cutIn', 'hirameki', 'henso'];

function parseTsv(file, pkg, kind) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const hdr = lines[0].split('\t');
  const I = (n) => hdr.indexOf(n);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t');
    const id = (c[0] || '').trim();
    if (!id) continue;
    const get = (n) => {
      const j = I(n);
      return j >= 0 ? (c[j] || '').trim() : '';
    };
    const texts = {};
    for (const col of TEXT_COLS) texts[col] = get(col);
    rows.push({
      id, // cardNum (例: D08003 / B08004) — CardDef.id と一致 (P variant は CardDef 側のみ)
      cardId: get('cardId'), // 公式カードNo (例: 0489) — 同一カード判定 (rules/02) 用
      pkg,
      kind, // character | event | partner | case (TSV ファイル名由来)
      title: get('title'),
      color: get('color'),
      level: get('level'),
      ap: get('ap'),
      lp: get('lp'),
      rarity: get('rarity'),
      features: get('features'),
      caseLevels: kind === 'case' ? { first: get('difficultyFirst'), second: get('difficultySecond') } : undefined,
      texts,
      qa: get('qAndA'),
    });
  }
  return rows;
}

function loadCorpus(root) {
  const base = path.join(root, '.claude', 'specs', 'cards-data');
  const out = [];
  for (const pkg of fs.readdirSync(base).sort()) {
    const dir = path.join(base, pkg);
    if (!fs.statSync(dir).isDirectory() || pkg.startsWith('_')) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.tsv')) continue;
      out.push(...parseTsv(path.join(dir, f), pkg, f.replace('.tsv', '')));
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

function dupIds(corpus) {
  const seen = new Set();
  const dups = new Set();
  for (const c of corpus) {
    if (seen.has(c.id)) dups.add(c.id);
    seen.add(c.id);
  }
  return [...dups].sort();
}

if (require.main === module) {
  const root = path.join(__dirname, '..', '..');
  const corpus = loadCorpus(root);
  const dups = dupIds(corpus);
  const byKind = {};
  let withText = 0;
  for (const c of corpus) {
    byKind[c.kind] = (byKind[c.kind] || 0) + 1;
    if (TEXT_COLS.some((k) => c.texts[k])) withText++;
  }
  const outDir = path.join(root, '.tmp', 'compiler');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'corpus.json'), JSON.stringify({ count: corpus.length, cards: corpus }, null, 1));
  console.log(`corpus: ${corpus.length} cards (${Object.entries(byKind).map(([k, n]) => `${k}=${n}`).join(' ')})`);
  console.log(`  text-bearing: ${withText} / vanilla: ${corpus.length - withText} / dup ids: ${dups.length}${dups.length ? ' ' + dups.join(',') : ''}`);
}

module.exports = { loadCorpus, dupIds, TEXT_COLS };
