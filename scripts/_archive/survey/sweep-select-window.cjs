/**
 * sweep certify window selector (2026-06-15)
 * .tmp/sweep/certify-queue.json から:
 *   1. 全 rep の rec ファイルを .tmp/taskA/recs/<rep>.json に書き出す (wf-certify が id 文字列で読む用)
 *   2. window N の rep id を層化抽出 (N に最も影響する partial/open gate 優先 + green 較正)
 * 使い方: node scripts/survey/sweep-select-window.cjs <perGate=4> <greenSample=6>
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const q = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/sweep/certify-queue.json'), 'utf8'));
const recsDir = path.join(ROOT, '.tmp/taskA/recs');
fs.mkdirSync(recsDir, { recursive: true });

// 1. rec ファイル書き出し (全 rep)
const clean = (s) => (s || '').replace(/\\n|\r?\n/g, ' ').replace(/ +/g, ' ').trim();
for (const it of q.items) {
  const rec = {
    rep: it.rep, kind: it.kind, title: it.title, color: it.color, level: it.level,
    ap: it.ap, lp: it.lp, features: it.features,
    effect: clean(it.effect), cutIn: clean(it.cutIn), hirameki: clean(it.hirameki), henso: clean(it.henso),
  };
  fs.writeFileSync(path.join(recsDir, `${it.rep}.json`), JSON.stringify(rec, null, 1));
}

// 2. window 1 層化抽出
const perGate = Number(process.argv[2] || 4);
const greenSample = Number(process.argv[3] || 6);
const done = new Set(
  fs.existsSync(path.join(ROOT, '.tmp/certify'))
    ? fs.readdirSync(path.join(ROOT, '.tmp/certify')).filter((f) => f.endsWith('.json') && !f.endsWith('.verify.json')).map((f) => f.replace(/\.json$/, ''))
    : [],
);
const avail = q.items.filter((it) => !done.has(it.rep));

// gate 別グループ
const byGate = new Map();
const greens = [];
for (const it of avail) {
  if (it.priorVerdict === 'greenCandidate') { greens.push(it); continue; }
  const g = it.priorGate || '(none)';
  (byGate.get(g) ?? byGate.set(g, []).get(g)).push(it);
}

const maxTotal = Number(process.argv[4] || 26);
const pick = [];
// partial gate を最優先 (green 化しうる → N に最大影響): partial は perGate 件、open は代表 1 件 (sig>=2 のみ)。
const gateEntries = [...byGate.entries()].sort((a, b) => {
  const sa = a[1][0].priorStatus === 'partial' ? 0 : 1;
  const sb = b[1][0].priorStatus === 'partial' ? 0 : 1;
  return sa - sb || b[1].length - a[1].length;
});
for (const [, items] of gateEntries) {
  items.sort((a, b) => (b.cloneTargets?.length || 0) - (a.cloneTargets?.length || 0) || a.rep.localeCompare(b.rep));
  const isPartial = items[0].priorStatus === 'partial';
  // partial は perGate 件サンプル; open は sig>=2 の gate のみ代表 1 件 (singleton open は明白ゲート扱い、certify不要)
  const take = isPartial ? perGate : items.length >= 2 ? 1 : 0;
  for (const it of items.slice(0, take)) pick.push(it.rep);
}
// green 較正サンプル: rep 昇順で等間隔 greenSample 件
greens.sort((a, b) => a.rep.localeCompare(b.rep));
const greenPicked = [];
const step = Math.max(1, Math.floor(greens.length / greenSample));
for (let i = 0; i < greens.length && greenPicked.length < greenSample; i += step) greenPicked.push(greens[i].rep);

const ids = [...new Set([...pick, ...greenPicked])].slice(0, maxTotal);
fs.writeFileSync(path.join(ROOT, '.tmp/sweep/window1-ids.json'), JSON.stringify(ids, null, 1));
console.error(`recs written: ${q.items.length}`);
console.error(`window1: ${ids.length} reps (perGate=${perGate}, greenSample=${greenSample})`);
console.error(`gates covered: ${byGate.size}, green pool: ${greens.length}`);
console.log(JSON.stringify(ids));
