// Fetch all non-MVP packages from takaratomy.co.jp official API.
// MVP scope (CT-D08, CT-D11) is already committed and is skipped.
// Run: node _fetch_all.js
// Output: <pkg>-api.json per package (combined across pages) in current directory.
const fs = require('fs');
const path = require('path');
const https = require('https');

const PACKAGES = [
  'CT-P01','CT-P02','CT-P03','CT-P04','CT-P05','CT-P06','CT-P07','CT-P08','CT-P09',
  'CT-D01','CT-D02','CT-D03','CT-D04','CT-D05','CT-D06','CT-D07','CT-D09','CT-D10',
  'PR'
];

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

(async () => {
  for (const pkg of PACKAGES) {
    const merged = { package: pkg, data: [] };
    // First page to learn lastPage.
    const url1 = `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1&package=${encodeURIComponent(pkg)}`;
    let p1;
    try {
      p1 = await get(url1);
    } catch (e) {
      console.error('FAIL', pkg, 'page=1', e.message);
      continue;
    }
    const last = p1.lastPage || 1;
    merged.data.push(...p1.data);
    for (let p = 2; p <= last; p++) {
      await sleep(300); // polite throttle
      const u = `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=${p}&package=${encodeURIComponent(pkg)}`;
      try {
        const r = await get(u);
        merged.data.push(...r.data);
      } catch (e) {
        console.error('FAIL', pkg, 'page=' + p, e.message);
      }
    }
    merged.total = merged.data.length;
    const outName = pkg.toLowerCase().replace('-', '-') + '-api.json'; // ct-p01-api.json
    const safe = pkg.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const outPath = path.join(__dirname, safe + '-api.json');
    fs.writeFileSync(outPath, JSON.stringify(merged), 'utf8');
    console.log('wrote', path.basename(outPath), `(${merged.total} cards, ${last} pages)`);
    await sleep(400);
  }
})();
