# Task 2: 出荷 dump + EXEMPLAR-SET 構築

**Files:**
- Create: `tests/factory/dump-shipped.test.ts` (ALL_CARDS → JSON, vitest を ts runtime として使う)
- Create: `scripts/build-exemplar-set.cjs`
- Test: `tests/factory/exemplar-set.test.ts`

**Interfaces:**
- Consumes: `fingerprint` (Task 1)。`ALL_CARDS: CardDef[]` (`@/cards`)。
- Produces: `.tmp/card-factory/shipped-abilities.json` = `[{ id, abilities }]`。
  `buildExemplarSet(shipped) → { tokens: string[]; skeletons: string[]; cards: number }`。
  `.tmp/card-factory/exemplar-set.json` (classifier 入力)。

> **CardDef の id フィールド名は Task 着手時に `src/engine/types/card-def.ts` で確認** (`id` 想定、
> 異なれば下記 `c.id` を実フィールドへ。`abilities` は確定)。closure は `'<fn>'` 文字列へ置換して dump。

- [ ] **Step 1: dump テストを書く** (`tests/factory/dump-shipped.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { ALL_CARDS } from '@/cards';
import * as fs from 'fs';

describe('dump shipped abilities', () => {
  it('全出荷カードの abilities を JSON 化', () => {
    const seen = new Set<string>();
    const out = ALL_CARDS.filter((c: any) => { const id = c.id; if (seen.has(id)) return false; seen.add(id); return true; })
      .map((c: any) => ({ id: c.id,
        abilities: JSON.parse(JSON.stringify(c.abilities ?? [], (_k, v) => typeof v === 'function' ? '<fn>' : v)) }));
    fs.mkdirSync('.tmp/card-factory', { recursive: true });
    fs.writeFileSync('.tmp/card-factory/shipped-abilities.json', JSON.stringify(out));
    expect(out.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: 実行して dump 生成** — Run: `npx vitest run tests/factory/dump-shipped.test.ts`。Expected: PASS、`.tmp/card-factory/shipped-abilities.json` 生成 (>1000 件)。

- [ ] **Step 3: exemplar-set テストを書く** (`tests/factory/exemplar-set.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
const { buildExemplarSet } = require('../../scripts/build-exemplar-set.cjs');

describe('buildExemplarSet', () => {
  it('全カードの token を union、skeleton を集合化', () => {
    const shipped = [
      { id: 'X1', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 1 } }] },
      { id: 'X2', abilities: [{ type: 'declared', description: 'd', effect: { kind: 'atom', verb: 'draw', n: 2 } }] },
    ];
    const e = buildExemplarSet(shipped);
    expect(e.tokens).toContain('verb:draw');
    expect(e.cards).toBe(2);
    expect(e.skeletons.length).toBe(1); // n だけ違う → 同一 skeleton
  });
});
```

- [ ] **Step 4: テスト失敗を確認** — Run: `npx vitest run tests/factory/exemplar-set.test.ts`。Expected: FAIL (module not found)。

- [ ] **Step 5: 最小実装** (`scripts/build-exemplar-set.cjs`)

```js
const fs = require('fs');
const path = require('path');
const { fingerprint } = require('./card-fingerprint.cjs');

function buildExemplarSet(shipped) {
  const tokens = new Set();
  const skeletons = new Set();
  for (const c of shipped) {
    const fp = fingerprint(c.abilities);
    fp.tokens.forEach((t) => tokens.add(t));
    skeletons.add(fp.skeletonHash);
  }
  return { tokens: [...tokens].sort(), skeletons: [...skeletons], cards: shipped.length };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const shipped = JSON.parse(fs.readFileSync(path.join(root, '.tmp/card-factory/shipped-abilities.json'), 'utf8'));
  const e = buildExemplarSet(shipped);
  fs.writeFileSync(path.join(root, '.tmp/card-factory/exemplar-set.json'), JSON.stringify(e, null, 1));
  console.log(`exemplar-set: ${e.cards} cards / ${e.tokens.length} tokens / ${e.skeletons.length} skeletons`);
}
module.exports = { buildExemplarSet };
```

- [ ] **Step 6: テスト pass を確認** — Run: `npx vitest run tests/factory/exemplar-set.test.ts`。Expected: PASS。
- [ ] **Step 7: 本番 exemplar-set 生成** — Run: `node scripts/build-exemplar-set.cjs`。出力件数を控える (card-factory-state.md 用)。
- [ ] **Step 8: commit** — `git add scripts/build-exemplar-set.cjs tests/factory/dump-shipped.test.ts tests/factory/exemplar-set.test.ts` → `git commit --no-verify -m "feat(factory): 出荷 dump + EXEMPLAR-SET 構築"` → FF push。
  (`.tmp/` は gitignore 想定 → 成果物 json は commit しない。生成手順がソース)。
