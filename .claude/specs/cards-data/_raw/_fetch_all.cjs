// Fetch ALL cards from takaratomy.co.jp official API (auto-discovery batch).
// 2026-07-02 rewrite: package list hardcode 廃止 — package 指定なし全ページ crawl →
// カード側 package フィールドでセット分割。新セット (ct-p10 等) は無変更で自動発見される。
// ct-d08/ct-d11 (旧 legacy _regen.js 経路) も本 crawl に統一。
// Run: node _fetch_all.cjs
// Output: <set>-api.json per set in this directory ({package, data, total})。
// 安全策: ページ取得は retry x3、失敗 or 件数不一致なら書き込みゼロで abort (部分更新なし)。
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards';
const THROTTLE_MS = 300;
const RETRIES = 3;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('JSON parse for ' + url + ': ' + e.message)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWithRetry(url) {
  let lastErr;
  for (let a = 1; a <= RETRIES; a++) {
    try { return await get(url); }
    catch (e) { lastErr = e; console.error('  retry ' + a + '/' + RETRIES + ':', e.message); await sleep(1000 * a); }
  }
  throw lastErr;
}

// package 文字列 → set dir 名。例: "CT-P01 Case-Booster 01 …" → ct-p01 / "PRカード" → pr-01
function setDirOf(pkgStr) {
  const m = /^(CT-[PD]\d+)/i.exec(pkgStr || '');
  if (m) return m[1].toLowerCase();
  if (/^PR/i.test(pkgStr || '')) return 'pr-01';
  return null; // 未知セット種別 — 呼び出し側で warn (取りこぼしは総数照合で検出される)
}

(async () => {
  // 1. 全ページ crawl (package 指定なし)。
  const first = await getWithRetry(`${API}?page=1`);
  const lastPage = first.lastPage || 1;
  const expectedTotal = first.total;
  const all = [...first.data];
  console.log(`crawl: total=${expectedTotal} pages=${lastPage}`);
  for (let p = 2; p <= lastPage; p++) {
    await sleep(THROTTLE_MS);
    const r = await getWithRetry(`${API}?page=${p}`);
    all.push(...r.data);
    if (p % 10 === 0) console.log(`  page ${p}/${lastPage} (${all.length} cards)`);
  }

  // 2. 総数照合 — 不一致なら書き込まず abort (部分 snapshot で TSV を壊さない)。
  if (all.length !== expectedTotal) {
    console.error(`ABORT: collected ${all.length} != API total ${expectedTotal} — no files written`);
    process.exit(1);
  }

  // 3. セット分割。
  const bySet = new Map();
  const unknown = [];
  for (const c of all) {
    const dir = setDirOf(c.package);
    if (!dir) { unknown.push(c); continue; }
    if (!bySet.has(dir)) bySet.set(dir, []);
    bySet.get(dir).push(c);
  }
  if (unknown.length) {
    console.warn(`WARN: ${unknown.length} cards with unrecognized package (kept in _unknown-api.json):`);
    for (const p of [...new Set(unknown.map(c => c.package))]) console.warn('  ' + p);
  }

  // 4. セットごとに書き込み (id 昇順で決定論化)。既存に無いセット = 新セットとして報告。
  const hideCount = all.filter(c => c.show_hide && c.show_hide !== '表示').length;
  if (hideCount) console.warn(`WARN: ${hideCount} cards with show_hide != 表示 (含めて出力)`);
  const written = [];
  for (const [dir, cards] of [...bySet.entries()].sort()) {
    cards.sort((a, b) => (a.id || 0) - (b.id || 0));
    const outPath = path.join(__dirname, dir + '-api.json');
    const isNew = !fs.existsSync(outPath);
    fs.writeFileSync(outPath, JSON.stringify({ package: cards[0].package, data: cards, total: cards.length }), 'utf8');
    written.push(dir);
    console.log(`wrote ${dir}-api.json (${cards.length} cards)${isNew ? '  ★NEW SET' : ''}`);
  }
  if (unknown.length) {
    fs.writeFileSync(path.join(__dirname, '_unknown-api.json'),
      JSON.stringify({ package: 'UNKNOWN', data: unknown, total: unknown.length }), 'utf8');
  }
  console.log(`done: ${all.length} cards across ${written.length} sets`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
