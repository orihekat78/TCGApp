# Task 4: card-text-crosscheck.cjs (TSV literal ↔ DSL param 突合)

**目的:** fingerprint 同型は param を消すため「色/数値/filter 誤写」を捕まえない。TSV 原テキストの literal が
DSL param に出現するか機械突合し、未出現 → **FAIL = T2/opus escalate** (fail-closed)。T0 から opus を外しても誤写を機械で止める。

**Files:** Create `scripts/card-text-crosscheck.cjs` / Test `tests/factory/crosscheck.test.ts`

**Interfaces:** `extractLiterals(text) → string[]` / `crosscheck(abilities, texts) → { ok; missing }`。`texts` = `[effect, cutIn, hirameki, henso]`。
CLI は `.tmp/card-factory/t0-abilities.json` (`[{id, abilities}]`) を TSV と突合。TSV は header-index 読み (`.tmp/_fulltext.cjs` 準拠、列番号 hardcode 禁止)。

> **限界 (明記):** substring 一致は coincidental false-pass を許す。だが「印字値が DSL に **無い**」誤写は確実に FAIL する
> (= misread 検出が目的)。false-fail は常に安全側 (T2 escalate)。

- [ ] **Step 1: 失敗テストを書く** (`tests/factory/crosscheck.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
const { extractLiterals, crosscheck } = require('../../scripts/card-text-crosscheck.cjs');
const text = '【黒】以外の色を持つ場合、AP8000以下のキャラを1枚までリムーブ。特徴[黒ずくめの組織]';
const ok = [{ type: 'declared', description: 'd', condition: { kind: 'caseColorNot', color: '黒' },
  cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 } }];

describe('crosscheck', () => {
  it('色・数値・枚数・特徴 を抽出', () => {
    expect(extractLiterals(text)).toEqual(expect.arrayContaining(['黒', '8000', '1', '黒ずくめの組織']));
  });
  it('印字 literal が全部 DSL に在れば ok', () => {
    expect(crosscheck(ok, [text]).ok).toBe(true);
  });
  it('色を誤写 (黒→白) すると FAIL', () => {
    const bad = JSON.parse(JSON.stringify(ok)); bad[0].condition.color = '白';
    const r = crosscheck(bad, [text]);
    expect(r.ok).toBe(false); expect(r.missing).toContain('黒');
  });
});
```

- [ ] **Step 2: テスト失敗を確認** — `npx vitest run tests/factory/crosscheck.test.ts` → FAIL (module not found)。

- [ ] **Step 3: 最小実装** (`scripts/card-text-crosscheck.cjs`)

```js
const fs = require('fs');
const path = require('path');

function extractLiterals(text) {
  if (!text) return [];
  const out = new Set();
  const add = (re, g) => { for (const m of text.matchAll(re)) out.add(m[g]); };
  add(/【(赤|青|黄|緑|黒|白)】/g, 1); add(/特徴[\[「]([^\]」]+)[\]」]/g, 1);
  add(/カード名[\[「]([^\]」]+)[\]」]/g, 1); add(/《([^》]+)》/g, 1);
  add(/(\d{3,})/g, 1); add(/(\d+)\s*枚/g, 1);          // AP/LP(1000+), 枚数
  add(/レベル(\d+)/g, 1); add(/(\d+)\s*以[下上]/g, 1); // レベル, 閾値
  return [...out];
}

function crosscheck(abilities, texts) {
  const blob = JSON.stringify(abilities);
  const lits = [...new Set(texts.flatMap((t) => extractLiterals(t)))];
  const missing = lits.filter((l) => !blob.includes(l));
  return { ok: missing.length === 0, missing };
}

function loadTsv() {
  const root = path.join(__dirname, '..', '.claude', 'specs', 'cards-data');
  const rows = {};
  for (const pkg of fs.readdirSync(root)) {
    const dir = path.join(root, pkg);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.tsv')) continue;
      const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter((l) => l.trim());
      const hdr = lines[0].split('\t'); const I = (n) => hdr.indexOf(n);
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split('\t');
        rows[(c[0] || '').trim()] = ['effect', 'cutIn', 'hirameki', 'henso'].map((k) => (I(k) >= 0 ? (c[I(k)] || '').trim() : ''));
      }
    }
  }
  return rows;
}

if (require.main === module) {
  const rows = loadTsv();
  const cands = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.tmp/card-factory/t0-abilities.json'), 'utf8'));
  let fail = 0;
  for (const c of cands) {
    const r = crosscheck(c.abilities, rows[c.id] || []);
    if (!r.ok) { fail++; console.log(`FAIL ${c.id}: missing ${r.missing.join(', ')}`); }
  }
  console.log(`crosscheck: ${cands.length - fail}/${cands.length} ok`);
  process.exit(fail ? 1 : 0);
}
module.exports = { extractLiterals, crosscheck };
```

- [ ] **Step 4: pass 確認** — `npx vitest run tests/factory/crosscheck.test.ts` → PASS (3)。
- [ ] **Step 5: commit** — `git add scripts/card-text-crosscheck.cjs tests/factory/crosscheck.test.ts` → `git commit --no-verify -m "feat(factory): TSV literal↔DSL param 機械突合 (fail-closed)"` → FF push。
