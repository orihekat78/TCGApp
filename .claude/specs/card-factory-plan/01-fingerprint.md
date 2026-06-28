# Task 1: card-fingerprint.cjs (純関数 fingerprint)

**Files:** Create `scripts/card-fingerprint.cjs` / Test `tests/factory/fingerprint.test.ts`

**Interfaces:** Produces `fingerprint(abilities) → { tokens: string[]; skeletonHash: string }`。`abilities` = CardDef/spec の
`.abilities` (plain object tree)。`tokens` = capability token のソート済集合 (`verb:*`/`kind:*`/`filter:*`/`hook:*`/`type:*`/`cont:*`/`shared:*`/`closure`)。
`skeletonHash` = param(色/数/名/説明) を消した構造の sha1。

- [ ] **Step 1: 失敗テストを書く** (`tests/factory/fingerprint.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
const { fingerprint } = require('../../scripts/card-fingerprint.cjs');
const rm = (ap: number) => [{ type: 'declared', description: 'd', cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: ap }, max: 1 } }];

describe('fingerprint', () => {
  it('色/数値だけ違う2枚は同一 skeletonHash + 正しい token', () => {
    const x = fingerprint(rm(8000)); const y = fingerprint(rm(5000));
    expect(x.skeletonHash).toBe(y.skeletonHash);
    expect(x.tokens).toEqual(expect.arrayContaining(['verb:sceneRemove', 'filter:apMax', 'kind:sleepSelf', 'type:declared']));
  });
  it('構造が違えば skeletonHash も違う', () => {
    const y = fingerprint([{ type: 'declared', description: 'd', effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 }, { kind: 'atom', verb: 'draw', n: 1 }] } }]);
    expect(fingerprint(rm(8000)).skeletonHash).not.toBe(y.skeletonHash);
    expect(y.tokens).toContain('verb:draw');
  });
  it('closure(関数) は token closure を立てる', () => {
    expect(fingerprint([{ type: 'continuous', description: 'd', continuousModifier: { grantKeywords: () => [] } }]).tokens).toContain('closure');
  });
});
```

- [ ] **Step 2: テスト失敗を確認** — `npx vitest run tests/factory/fingerprint.test.ts` → FAIL (module not found)。

- [ ] **Step 3: 最小実装** (`scripts/card-fingerprint.cjs`)

```js
const crypto = require('crypto');
const STRUCTURAL = new Set(['kind', 'verb', 'hook', 'type', 'scope', '__shared']);

function collect(node, t) {
  if (typeof node === 'function') { t.add('closure'); return; }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((x) => collect(x, t));
  if (typeof node.verb === 'string') t.add('verb:' + node.verb);
  if (typeof node.kind === 'string') t.add('kind:' + node.kind);
  for (const ff of ['filter', 'auraFilter'])
    if (node[ff] && typeof node[ff] === 'object' && !Array.isArray(node[ff]))
      for (const k of Object.keys(node[ff])) t.add('filter:' + k);
  for (const f of node.filterAny || []) for (const k of Object.keys(f || {})) t.add('filter:' + k);
  for (const [k, v] of Object.entries(node)) { if (['filter', 'auraFilter', 'filterAny'].includes(k)) continue; collect(v, t); }
}
function abilityTokens(ab, t) {
  if (ab.__shared) t.add('shared:' + ab.__shared);
  if (ab.type) t.add('type:' + ab.type);
  if (ab.scope) t.add('scope:' + ab.scope);
  if (ab.limit && ab.limit.kind) t.add('limit:' + ab.limit.kind);
  if (ab.trigger) {
    if (ab.trigger.hook) t.add('hook:' + ab.trigger.hook);
    for (const h of ab.trigger.hooks || []) t.add('hook:' + h);
    if (ab.trigger.selfOnly) t.add('trig:selfOnly');
    if (ab.trigger.__eventUse) t.add('trig:eventUse');
    if (typeof ab.trigger.matcher === 'function') t.add('closure');
    collect(ab.trigger.matcherCondition, t);
  }
  if (ab.continuousModifier) for (const k of Object.keys(ab.continuousModifier)) {
    t.add('cont:' + k); if (typeof ab.continuousModifier[k] === 'function') t.add('closure');
  }
  collect(ab.effect, t); collect(ab.condition, t); collect(ab.cost, t);
  if (ab.args && ab.args.inner) collect(ab.args.inner, t);
}
function skel(node) {
  if (typeof node === 'function') return '<fn>';
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(skel);
  const o = {};
  for (const k of Object.keys(node).sort()) {
    const v = node[k];
    if (STRUCTURAL.has(k)) o[k] = v;
    else if (k === 'filter' || k === 'auraFilter') o[k] = Object.keys(v || {}).sort();
    else if (k === 'filterAny') o[k] = (v || []).map((f) => Object.keys(f || {}).sort());
    else o[k] = skel(v);
  }
  return o;
}
function fingerprint(abilities) {
  const t = new Set();
  (abilities || []).forEach((ab) => abilityTokens(ab, t));
  const skeleton = (abilities || []).map((ab) => ({ type: ab.type || null, scope: ab.scope || null,
    trigger: ab.trigger ? { hook: ab.trigger.hook || null, hooks: ab.trigger.hooks || [], selfOnly: !!ab.trigger.selfOnly } : null,
    cont: ab.continuousModifier ? Object.keys(ab.continuousModifier).sort() : null,
    effect: skel(ab.effect), condition: skel(ab.condition), cost: skel(ab.cost), shared: ab.__shared || null }));
  return { tokens: [...t].sort(), skeletonHash: crypto.createHash('sha1').update(JSON.stringify(skeleton)).digest('hex') };
}
module.exports = { fingerprint };
```

- [ ] **Step 4: pass 確認** — `npx vitest run tests/factory/fingerprint.test.ts` → PASS (3)。
- [ ] **Step 5: commit** — `git add scripts/card-fingerprint.cjs tests/factory/fingerprint.test.ts` → `git commit --no-verify -m "feat(factory): card fingerprint 純関数"` → FF push。
