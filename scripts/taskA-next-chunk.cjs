/**
 * Task A — 次の certify chunk を抽出。
 * certify-queue.json から、.tmp/certify/<rep>.json が無い item を先頭から N 件 (default 30)。
 * stdout に workflow args 用 JSON を出す。--list で残数のみ。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const q = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/taskA/certify-queue.json'), 'utf8'));
const done = new Set(
  fs.existsSync(path.join(ROOT, '.tmp/certify'))
    ? fs.readdirSync(path.join(ROOT, '.tmp/certify')).filter((f) => f.endsWith('.json') && !f.endsWith('.verify.json')).map((f) => f.replace(/\.json$/, ''))
    : [],
);
const remaining = q.items.filter((it) => !done.has(it.rep));
if (process.argv.includes('--list')) {
  console.log(JSON.stringify({ total: q.items.length, certified: done.size, remaining: remaining.length }));
  process.exit(0);
}
const n = Number(process.argv[2] || 30);
const offset = Number(process.argv[3] || 0);
const clean = (s) => (s || '').replace(/\\n|\r?\n/g, ' ').replace(/ +/g, ' ').trim();
const chunk = remaining.slice(offset, offset + n).map(({ cloneTargets, origCluster, ...r }) => ({
  ...r,
  effect: clean(r.effect), cutIn: clean(r.cutIn), hirameki: clean(r.hirameki), henso: clean(r.henso),
}));
console.log(JSON.stringify(chunk));
