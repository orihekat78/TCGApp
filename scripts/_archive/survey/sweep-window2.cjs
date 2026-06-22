/** window 2 selector: green-candidate false-green 率測定用の層化サンプル + 未確認大型gate代表。
 * 使い方: node scripts/survey/sweep-window2.cjs <greenN=20>  (done 済は除外) */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ls = JSON.parse(fs.readFileSync(path.join(ROOT, '.tmp/sweep/landscape.json'), 'utf8'));
const done = new Set(fs.existsSync(path.join(ROOT, '.tmp/certify'))
  ? fs.readdirSync(path.join(ROOT, '.tmp/certify')).filter(f => f.endsWith('.json') && !f.endsWith('.verify.json')).map(f => f.replace(/\.json$/, '')) : []);
const greenN = Number(process.argv[2] || 20);
const pkgOf = (rep) => (rep.match(/^[BD](\d\d)/) ? 'B'+rep.match(/^[BD](\d\d)/)[1] : rep.slice(0,3));
// green: package 横断で層化 (各pkgから clone-size desc) → round-robin で greenN 件
const greens = ls.greenCandidate.filter(r => !done.has(r.rep));
const byPkg = new Map();
for (const r of greens) { const p = pkgOf(r.rep); (byPkg.get(p) ?? byPkg.set(p, []).get(p)).push(r); }
for (const arr of byPkg.values()) arr.sort((a,b)=> b.size - a.size || a.rep.localeCompare(b.rep));
const pkgs = [...byPkg.keys()].sort();
const greenPick = [];
let i = 0;
while (greenPick.length < greenN && pkgs.some(p => byPkg.get(p).length)) {
  const p = pkgs[i % pkgs.length]; const arr = byPkg.get(p);
  if (arr.length) greenPick.push(arr.shift().rep);
  i++;
}
// 未確認大型 gate 代表 (window1 で 1件しか踏んでいない gate を追加サンプル)
const gateSample = [];
const wantGates = ['cutin-subtype', 'grant textual', 'hand→deck-bottom', 'partner-area-structure (ビ', 'name-designation'];
for (const g of wantGates) {
  const cands = ls.yellow.concat(ls.black).filter(r => (r.gate||'').includes(g) && !done.has(r.rep));
  cands.sort((a,b)=> b.size - a.size || a.rep.localeCompare(b.rep));
  for (const c of cands.slice(0,2)) gateSample.push(c.rep);
}
const ids = [...new Set([...greenPick, ...gateSample])];
fs.writeFileSync(path.join(ROOT, '.tmp/sweep/window2-ids.json'), JSON.stringify(ids, null, 1));
console.error(`window2: ${ids.length} reps (green ${greenPick.length} across ${pkgs.length} pkgs + gate-sample ${gateSample.length})`);
console.log(JSON.stringify(ids));
