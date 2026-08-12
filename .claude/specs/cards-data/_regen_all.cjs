// TSV regenerator: scans _raw/*-api.json and writes <pkg>/<kind>.tsv for each.
// Run: node _regen_all.cjs
// Existing ct-d08/ and ct-d11/ remain regenerable via the legacy _regen.js too.
const fs = require('fs');
const path = require('path');

function regenerateAll({ baseDir = __dirname, rawDir = path.join(baseDir, '_raw') } = {}) {

const canonicalLiveRoot = process.platform === 'win32' ? __dirname.toLowerCase() : __dirname;
const requestedRoot = process.platform === 'win32' ? path.resolve(baseDir).toLowerCase() : path.resolve(baseDir);
let requestedRealRoot = requestedRoot;
try {
  const realRoot = fs.realpathSync.native(path.resolve(baseDir));
  requestedRealRoot = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
} catch {
  // The ordinary read path will reject a missing or invalid staging root.
}
if (requestedRoot === canonicalLiveRoot || requestedRealRoot === canonicalLiveRoot) {
  throw new Error('direct TSV regeneration of the live cards-data root is forbidden');
}
if (path.resolve(rawDir) !== path.join(path.resolve(baseDir), '_raw')) {
  throw new Error('TSV regeneration raw root must belong to the cards-data root');
}

const kindMap = { 'パートナー':'partner', 'キャラ':'character', 'イベント':'event', '事件':'case' };

const colsByKind = {
  partner:   ['cardNum','cardId','title','color','lp','rarity','features','imagePath','effect','illustrator','qAndA'],
  character: ['cardNum','cardId','title','color','level','ap','lp','rarity','features','imagePath','effect','cutIn','hirameki','henso','illustrator','flavor','qAndA'],
  event:     ['cardNum','cardId','title','color','level','rarity','imagePath','effect','cutIn','hirameki','illustrator','flavor','qAndA'],
  case:      ['cardNum','cardId','title','color','rarity','imagePath','difficultyFirst','difficultySecond','effect','illustrator','qAndA']
};

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function traitsOf(c) {
  return [c.category1, c.category2, c.category3].filter(Boolean).join('|');
}

function cellFor(c, col) {
  switch (col) {
    case 'cardNum': return esc(c.card_num);
    case 'cardId': return esc(c.card_id);
    case 'title': return esc(c.title);
    case 'color': return esc(c.color);
    case 'level': return esc(c.cost);
    case 'ap': return esc(c.ap);
    case 'lp': return esc(c.lp);
    case 'rarity': return esc(c.rarity);
    case 'features': return traitsOf(c);
    case 'imagePath': return esc(c.main_path);
    case 'difficultyFirst': return esc(c.difficulty_first);
    case 'difficultySecond': return esc(c.difficulty_second);
    case 'effect': return esc(c.feature);
    case 'cutIn': return esc(c.cut_in);
    case 'hirameki': return esc(c.hirameki);
    case 'henso': return esc(c.henso);
    case 'illustrator': return esc(c.illustrator);
    case 'flavor': return esc(c.flavor_txt);
    case 'qAndA': return esc(c.q_a);
    default: return '';
  }
}

const rawEntries = fs.readdirSync(rawDir, { withFileTypes: true });
for (const entry of rawEntries) {
  if (!entry.isFile() || !/^(?:ct-(?:d|p)\d{2}|pr-\d{2})-api\.json$/.test(entry.name)) {
    throw new Error('invalid raw package filename: ' + entry.name);
  }
}
const files = rawEntries.map((entry) => entry.name).sort();
for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
  if (entry.isDirectory() && /^(?:ct-(?:d|p)\d{2}|pr-\d{2})$/i.test(entry.name)) {
    fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
  }
}
let totalCards = 0;
for (const file of files) {
  const setDir = file.replace(/-api\.json$/, ''); // e.g. ct-p01
  const dir = path.join(baseDir, setDir);
  const raw = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
  if (!raw.data || raw.data.length === 0) {
    console.log('skip ' + setDir + ' (0 cards)');
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  const grouped = {};
  for (const c of raw.data) {
    const k = kindMap[c.type] || 'unknown';
    (grouped[k] = grouped[k] || []).push(c);
  }
  let setTotal = 0;
  for (const [kind, cards] of Object.entries(grouped)) {
    const cols = colsByKind[kind];
    if (!cols) {
      console.warn('  ' + setDir + ': skipping unknown kind ' + kind + ' (' + cards.length + ' cards)');
      continue;
    }
    const lines = [cols.join('\t')];
    for (const c of cards) lines.push(cols.map(col => cellFor(c, col)).join('\t'));
    const out = path.join(dir, kind + '.tsv');
    fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
    console.log('wrote ' + path.relative(baseDir, out) + ' (' + cards.length + ' cards)');
    setTotal += cards.length;
  }
  totalCards += setTotal;
}
console.log('total ' + totalCards + ' cards across ' + files.length + ' packages');

  return { totalCards, packageCount: files.length };
}

function regenerateAllLocked({
  baseDir = __dirname,
  rawDir = path.join(baseDir, '_raw'),
  hooks,
  renameSync,
  rmSync,
} = {}) {
  const {
    mutateCardsDataRoot,
  } = require('../../../scripts/cards/official-api.cjs');
  const expectedRawDir = path.join(path.resolve(baseDir), '_raw');
  if (path.resolve(rawDir) !== expectedRawDir) {
    throw new Error('TSV regeneration raw root must belong to the cards-data root');
  }
  const mutation = mutateCardsDataRoot({
    baseDir,
    mutate: ({ baseDir: stagedBaseDir }) => regenerateAll({
      baseDir: stagedBaseDir,
      rawDir: path.join(stagedBaseDir, '_raw'),
    }),
    ...(renameSync ? { renameSync } : {}),
    ...(rmSync ? { rmSync } : {}),
    ...(hooks ? { hooks } : {}),
  });
  return {
    ...mutation.value,
    lockCleanupPending: mutation.lockCleanupPending ?? false,
    cleanupPending: mutation.cleanupPending,
  };
}

if (require.main === module) {
  const result = regenerateAllLocked();
  if (result.lockCleanupPending) console.error('TSV regeneration committed; cards-data write-lock cleanup is pending');
}

module.exports = { regenerateAll, regenerateAllLocked };
