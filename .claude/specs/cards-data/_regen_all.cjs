// TSV regenerator: scans _raw/*-api.json and writes <pkg>/<kind>.tsv for each.
// Run: node _regen_all.cjs
// Existing ct-d08/ and ct-d11/ remain regenerable via the legacy _regen.js too.
const fs = require('fs');
const path = require('path');
const baseDir = __dirname;
const rawDir = path.join(baseDir, '_raw');

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

const files = fs.readdirSync(rawDir).filter(f => /-api\.json$/.test(f));
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
