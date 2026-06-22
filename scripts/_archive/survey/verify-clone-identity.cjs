/**
 * clone テキスト同一性検証 (トリアージ・スイープ出荷の安全弁)。
 *
 * 背景: sweep-2026-06-15.ts の signature() は色/数値/特徴を抽象化する lossy 関数。
 *   よって certify-queue の cloneTargets は rep と「同型」だが色/数/特徴が**異なる可能性**がある
 *   (card-wave SKILL §2 警告 / BUG 由来)。certified spec を blind clone するのは不正。
 *   → clone の effect/cutIn/hirameki/henso が rep と **byte 同一** の場合のみ採用可。
 *
 * 使い方: node scripts/survey/verify-clone-identity.cjs <rep1> <rep2> ...
 *   引数 = 採用する green rep の id 群。
 * 出力 (stdout, JSON): { adopt:[{rep, fromClones:[...identical]}], excludeClones:[{clone, of, reason}] }
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, '.claude', 'specs', 'cards-data');

function parseTsv(p) {
  const raw = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  if (!lines.length) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

// catalog: cardNum -> textTuple
const catalog = new Map();
for (const pkg of fs.readdirSync(DATA_DIR).filter((d) => /^(ct-[dp]\d\d|pr-\d\d)$/.test(d))) {
  for (const kind of ['character', 'event', 'case', 'partner']) {
    const p = path.join(DATA_DIR, pkg, `${kind}.tsv`);
    if (!fs.existsSync(p)) continue;
    for (const r of parseTsv(p)) {
      if (!r.cardNum) continue;
      catalog.set(r.cardNum, {
        title: r.title ?? '', color: r.color ?? '', level: r.level ?? '', ap: r.ap ?? '', lp: r.lp ?? '',
        features: r.features ?? '', effect: r.effect ?? '', cutIn: r.cutIn ?? '', hirameki: r.hirameki ?? '', henso: r.henso ?? '',
      });
    }
  }
}

// text identity key: effect/cutIn/hirameki/henso のみ (色/数/特徴/名は ability に効くので含めるべきだが、
// ability は TEXT 由来。テキスト同一なら ability も同一。features/color の差は ability 句に現れるなら effect 文字列に差が出る。
// よって 4 テキストフィールドの byte 同一 = spec 流用安全。)
const textKey = (c) => [c.effect, c.cutIn, c.hirameki, c.henso].join('');

const q = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/sweep/certify-queue.json'), 'utf8'));
const cloneMap = new Map(q.items.map((it) => [it.rep, it.cloneTargets || []]));

// 既実装スキャン
const implemented = new Set();
for (const d of fs.readdirSync(path.join(ROOT, 'src', 'cards'))) {
  const dir = path.join(ROOT, 'src', 'cards', d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) implemented.add(f.replace(/\.ts$/, ''));
}

const reps = process.argv.slice(2);
const adopt = [];
const excludeClones = [];
for (const rep of reps) {
  const repCard = catalog.get(rep);
  if (!repCard) { adopt.push({ rep, fromClones: [], note: 'rep not in catalog' }); continue; }
  const repKey = textKey(repCard);
  const identical = [];
  for (const cl of cloneMap.get(rep) || []) {
    if (implemented.has(cl)) { excludeClones.push({ clone: cl, of: rep, reason: 'already-implemented' }); continue; }
    const clCard = catalog.get(cl);
    if (!clCard) { excludeClones.push({ clone: cl, of: rep, reason: 'not-in-catalog' }); continue; }
    if (textKey(clCard) === repKey) identical.push(cl);
    else excludeClones.push({ clone: cl, of: rep, reason: 'text-DIVERGENT', clTitle: clCard.title,
      diff: { effect: clCard.effect !== repCard.effect, cutIn: clCard.cutIn !== repCard.cutIn,
        hirameki: clCard.hirameki !== repCard.hirameki, henso: clCard.henso !== repCard.henso } });
  }
  adopt.push({ rep, fromClones: identical });
}

const totalClones = adopt.reduce((n, a) => n + a.fromClones.length, 0);
console.log(JSON.stringify({
  reps: reps.length,
  identicalClones: totalClones,
  divergentExcluded: excludeClones.filter((e) => e.reason === 'text-DIVERGENT').length,
  alreadyImplExcluded: excludeClones.filter((e) => e.reason === 'already-implemented').length,
  adopt,
  excludeClones,
}, null, 1));
