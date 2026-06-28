# Task 3: card-classify.cjs (T0/T1/T2 分類器)

**Files:** Create `scripts/card-classify.cjs` / Test `tests/factory/classify.test.ts`

**Interfaces:** Consumes `fingerprint` (Task 1) + `exemplar-set.json` (Task 2)。候補 = certify spec の `.abilities`。
Produces `classify(abilities, exemplar) → { tier: 'T0'|'T1'|'T2'; reason?; novel? }`。
CLI `node scripts/card-classify.cjs <specs.json|dir>` → 件数表 + 各 rep の tier。

判定 (spec §1): closure → **T2** / 候補 token に exemplar 外あり(novel) → **T2** / skeletonHash が exemplar.skeletons に在る → **T0** / それ以外 → **T1**。

- [ ] **Step 1: 失敗テストを書く** (`tests/factory/classify.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
const { classify } = require('../../scripts/card-classify.cjs');
const { fingerprint } = require('../../scripts/card-fingerprint.cjs');
const proven = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 } }];

describe('classify', () => {
  it('同型出荷済 → T0', () => {
    const fp = fingerprint(proven);
    const ex = { tokens: fp.tokens, skeletons: [fp.skeletonHash] };
    const cand = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' },
      effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 5000 }, max: 1 } }];
    expect(classify(cand, ex).tier).toBe('T0');
  });
  it('token既出だが構造新規 → T1', () => {
    const ex = { tokens: ['type:declared', 'kind:atom', 'verb:sceneRemove', 'kind:sleepSelf',
      'filter:apMax', 'kind:sequence', 'verb:draw'], skeletons: ['none'] };
    const cand = [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' }, effect: { kind: 'sequence',
      steps: [{ kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 }, { kind: 'atom', verb: 'draw', n: 1 }] } }];
    expect(classify(cand, ex).tier).toBe('T1');
  });
  it('未出荷 primitive → T2', () => {
    const r = classify([{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'partnerSolveCase' } }],
      { tokens: ['verb:draw'], skeletons: [] });
    expect(r.tier).toBe('T2'); expect(r.novel).toContain('verb:partnerSolveCase');
  });
  it('closure → T2', () => {
    expect(classify([{ type: 'continuous', description: 'd', continuousModifier: { grantKeywords: () => [] } }],
      { tokens: [], skeletons: [] }).tier).toBe('T2');
  });
});
```

- [ ] **Step 2: テスト失敗を確認** — `npx vitest run tests/factory/classify.test.ts` → FAIL (module not found)。

- [ ] **Step 3: 最小実装** (`scripts/card-classify.cjs`)

```js
const fs = require('fs');
const path = require('path');
const { fingerprint } = require('./card-fingerprint.cjs');

function classify(abilities, exemplar) {
  const fp = fingerprint(abilities);
  if (fp.tokens.includes('closure')) return { tier: 'T2', reason: 'closure' };
  const tset = new Set(exemplar.tokens || []);
  const novel = fp.tokens.filter((t) => !tset.has(t));
  if (novel.length) return { tier: 'T2', reason: 'novel-token', novel };
  if (new Set(exemplar.skeletons || []).has(fp.skeletonHash)) return { tier: 'T0' };
  return { tier: 'T1' };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const exemplar = JSON.parse(fs.readFileSync(path.join(root, '.tmp/card-factory/exemplar-set.json'), 'utf8'));
  const target = process.argv[2];
  let specs = [];
  if (fs.statSync(target).isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (!f.endsWith('.json') || f.endsWith('.verify.json')) continue;
      try { specs.push(JSON.parse(fs.readFileSync(path.join(target, f), 'utf8'))); } catch (e) {}
    }
  } else { specs = JSON.parse(fs.readFileSync(target, 'utf8')); }
  const counts = { T0: 0, T1: 0, T2: 0 };
  for (const s of specs) {
    if (s.verdict && s.verdict !== 'green') continue;
    const r = classify(s.abilities || [], exemplar);
    counts[r.tier]++;
    console.log(`${r.tier}\t${s.rep || '?'}\t${r.reason || ''}${r.novel ? ' ' + r.novel.join(',') : ''}`);
  }
  console.log(`\nT0=${counts.T0} T1=${counts.T1} T2=${counts.T2} / ${specs.length}`);
}
module.exports = { classify };
```

- [ ] **Step 4: pass 確認** — `npx vitest run tests/factory/classify.test.ts` → PASS (4)。
- [ ] **Step 5: 実候補で件数確認** — `node scripts/card-classify.cjs .tmp/certify` → T0/T1/T2 分布を控える (初回 batch 規模)。
- [ ] **Step 6: commit** — `git add scripts/card-classify.cjs tests/factory/classify.test.ts` → `git commit --no-verify -m "feat(factory): T0/T1/T2 分類器"` → FF push。
