// TSV regenerator from fresh API JSON in _raw/.
// Run: node _regen.js
// To re-fetch from official API:
//   curl -s "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1&package=CT-D08" > _raw/ct-d08-api.json
//   curl -s "https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1&package=CT-D11" > _raw/ct-d11-api.json
const fs = require('fs');
const path = require('path');
const baseDir = __dirname;

const sets = { 'CT-D08': '_raw/ct-d08-api.json', 'CT-D11': '_raw/ct-d11-api.json' };
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

for (const [setName, srcFile] of Object.entries(sets)) {
  const setDir = setName.toLowerCase();
  const dir = path.join(baseDir, setDir);
  fs.mkdirSync(dir, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(path.join(baseDir, srcFile), 'utf8'));
  const grouped = {};
  for (const c of raw.data) {
    const k = kindMap[c.type] || 'unknown';
    (grouped[k] = grouped[k] || []).push(c);
  }
  for (const [kind, cards] of Object.entries(grouped)) {
    const cols = colsByKind[kind];
    if (!cols) continue;
    const lines = [cols.join('\t')];
    for (const c of cards) {
      const row = cols.map(col => {
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
          case 'effect': return esc(c.feature);     // API: feature = effect text
          case 'cutIn': return esc(c.cut_in);
          case 'hirameki': return esc(c.hirameki);
          case 'henso': return esc(c.henso);
          case 'illustrator': return esc(c.illustrator);
          case 'flavor': return esc(c.flavor_txt);
          case 'qAndA': return esc(c.q_a);
          default: return '';
        }
      });
      lines.push(row.join('\t'));
    }
    const out = path.join(dir, kind + '.tsv');
    fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
    console.log('wrote', path.relative(baseDir, out), '(' + cards.length + ' cards, ' + cols.length + ' cols)');
  }
}
