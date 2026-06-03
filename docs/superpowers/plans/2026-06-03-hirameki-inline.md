# ヒラメキ inline 化 + factory 廃止 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ヒラメキ factory (`hiramekiDraw` / `hiramekiCharStun`) を使う 3 カードを D08013 a2 同型の inline atom に展開し、factory を廃止する（動作不変）。

**Architecture:** カットイン inline 化と同じパターン。hiramekiDraw → `draw` atom (byte 一致)、hiramekiCharStun → `sceneSetState` 短縮形 (choice 除去, 同一 pick query)。factory/.test/.md を削除、barrel/index.test/caseTraitConditioned.test/INDEX を更新。

**Tech Stack:** TypeScript + Vitest + Playwright。

**設計ソース:** [docs/superpowers/specs/2026-06-03-hirameki-inline-design.md](../specs/2026-06-03-hirameki-inline-design.md)

---

## File Structure
- Modify: `src/cards/ct-d08/D08024.ts` (a2 inline), `src/cards/ct-d08/D08019.ts` (a2 inline), `src/cards/ct-d11/D11009.ts` (a3 inline)
- Delete: `src/cards/_shared/hiramekiDraw.ts`, `hiramekiCharStun.ts`, `tests/cards/_shared/hiramekiDraw.test.ts`, `hiramekiCharStun.test.ts`, `.claude/specs/shared-classes/hiramekiDraw.md`, `hiramekiCharStun.md`
- Modify: `src/cards/_shared/index.ts` (2 export 削除), `tests/cards/_shared/index.test.ts` (2 assertion 削除), `tests/cards/_shared/caseTraitConditioned.test.ts` (hiramekiDraw fixture → inline), `.claude/specs/shared-classes/INDEX.md`
- 不変: e2e/integration/listener hirameki tests (factory 非 import, カード駆動)

---

## Task 1: 3 カードを inline 化

**Files:** Modify `src/cards/ct-d08/D08024.ts`, `src/cards/ct-d08/D08019.ts`, `src/cards/ct-d11/D11009.ts`

- [ ] **Step 1: D08024 — a2 を inline draw に**。`import { hiramekiDraw } from '@/cards/_shared/hiramekiDraw';` を削除し、`a1` 定義の後に inline `a2` を追加:

```typescript
// a2: 【ヒラメキ】カードを1枚引く (旧 hiramekiDraw factory を inline 展開、D08013 a2 同型)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動 (action[事件] リムーブ時)
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};
```
  `abilities: [a1, hiramekiDraw({ n: 1, abilityId: 'a2' })],` → `abilities: [a1, a2],`。`AbilityDef` 型 import 済を確認 (D08024 は a1 で使用済)。

- [ ] **Step 2: D08019 — a2 を inline sceneSetState 短縮形に**。`import { hiramekiCharStun } from '../_shared/index.js';` を削除し、`a1` の後に inline `a2` を追加:

```typescript
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (旧 hiramekiCharStun factory を inline + sceneSetState 短縮形)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};
```
  `abilities: [a1, hiramekiCharStun({ side: 'either', abilityId: 'a2' })],` → `abilities: [a1, a2],`。

- [ ] **Step 3: D11009 — a3 を inline sceneSetState 短縮形に**。`import { partnerColorKeyword, hiramekiCharStun } from '../_shared/index.js';` を `import { partnerColorKeyword } from '../_shared/index.js';` に変更。`const a3 = hiramekiCharStun({ side: 'either', abilityId: 'a3' });` を inline `a3` に置換:

```typescript
// a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (旧 hiramekiCharStun factory を inline + sceneSetState 短縮形)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};
```
  `abilities: [a1, a2, a3]` は不変 (a3 が inline const になっただけ)。`AbilityDef` 型 import 済を確認 (a2 で使用済)。

- [ ] **Step 4: typecheck** `npx tsc --noEmit` Expected: 0 エラー (factory import 削除後も a2/a3 が inline で解決)。
- [ ] **Step 5: 各カード test** `npx vitest run tests/cards/ct-d08/D08024.test.ts tests/cards/ct-d08/D08019.test.ts tests/cards/ct-d11/D11009.test.ts` Expected: 全 PASS (動作不変)。
  - ⚠ 各 test が ability の **構造** (`effect.kind==='choice'` 等) を assert していたら、cutin/Phase3 同様 inline 後の shape (`'atom'`+`verb`) に更新する。動作 (state 結果) の assertion は不変。

---

## Task 2: factory 廃止 + 付随更新

**Files:** Delete factory + tests + specs、Modify index/caseTraitConditioned.test/INDEX

- [ ] **Step 1: barrel export 削除** — `src/cards/_shared/index.ts` の2行を削除:

```typescript
export { hiramekiCharStun } from './hiramekiCharStun.js';
export { hiramekiDraw } from './hiramekiDraw.js';
```
  代わりにコメント 1 行: `// hiramekiDraw / hiramekiCharStun は廃止 (2026-06-03): ヒラメキは各カードに inline atom で記述 (D08013 a2 同型)。`

- [ ] **Step 2: index.test.ts の2 assertion 削除** — `tests/cards/_shared/index.test.ts` の以下2行を削除:

```typescript
    expect(typeof shared.hiramekiCharStun).toBe('function');
    expect(typeof shared.hiramekiDraw).toBe('function');
```

- [ ] **Step 3: caseTraitConditioned.test.ts の hiramekiDraw fixture を inline に**。`import { hiramekiDraw } from '@/cards/_shared/hiramekiDraw';` を削除。2 箇所の `hiramekiDraw(...)` を inline AbilityDef に置換:

  L39 `const inner = hiramekiDraw({ n: 2, abilityId: 'a_inner' });` →
```typescript
    const inner: AbilityDef = {
      id: 'a_inner', type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      description: '【ヒラメキ】カードを2枚引く。',
      ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
    };
```
  L60 `const inner = hiramekiDraw({ n: 1 });` →
```typescript
    const inner: AbilityDef = {
      id: 'a_flash', type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '【ヒラメキ】カードを1枚引く。',
      ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
    };
```
  (既存 assertion `d.id==='a_inner'` / `d.type==='triggered'` / `d.effect===inner.effect` / validate.ok は inline でも成立)

- [ ] **Step 4: factory ファイル + unit test + spec を削除**:
```bash
git rm src/cards/_shared/hiramekiDraw.ts src/cards/_shared/hiramekiCharStun.ts \
  tests/cards/_shared/hiramekiDraw.test.ts tests/cards/_shared/hiramekiCharStun.test.ts \
  .claude/specs/shared-classes/hiramekiDraw.md .claude/specs/shared-classes/hiramekiCharStun.md
```

- [ ] **Step 5: shared-classes/INDEX.md 更新** — hiramekiCharStun / hiramekiDraw の行を廃止マーカーに、tree から削除 (cutinFixedAP の前例に倣う):

```markdown
| ~~hiramekiCharStun~~ | 廃止 2026-06-03 | — | ヒラメキは各カードに inline atom (D08013 a2 同型) | — |
| ~~hiramekiDraw~~ | 廃止 2026-06-03 | — | 同上 | — |
```

- [ ] **Step 6: typecheck + 関連 test** `npx tsc --noEmit && npx vitest run tests/cards/_shared/` Expected: 0 エラー / 全 PASS。

---

## Task 3: 全検証 + docs + commit

- [ ] **Step 1: 全 suite** `npx tsc --noEmit && npx vitest run` Expected: 全 PASS (factory test 削除分だけ件数減)。
- [ ] **Step 2: smoke** `npm run smoke:1000` Expected: 例外0。choice 除去で決着分布が動きうる (カード動作不変、bisect で確認可)。
- [ ] **Step 3: e2e** `npx playwright test tests/e2e/patterns/hirameki-draw.spec.ts tests/e2e/patterns/hirameki-char-stun.spec.ts` Expected: 全 PASS (カード駆動なので inline 後も挙動不変)。
- [ ] **Step 4: docs 再生 + commit** `npm run docs` で structure/mapping/progress 再生。changelog エントリ `.claude/changelog-entries/2026-06-03-01-hirameki-inline.md` 作成。

```bash
git add -A
git commit -m "refactor(cards): ヒラメキを inline atom 化 (hiramekiDraw/CharStun factory 廃止)"
```

---

## Self-Review
- **Spec coverage:** §scope 3カード→Task1 / §付随更新 factory+collateral→Task2 / §検証→Task3。全項目に対応 Task あり。
- **Placeholder scan:** 全 inline code を明示。caseTraitConditioned.test の fixture 置換コードも完全記述。Task1 Step5 の構造 assertion 更新は cutin/Phase3 の前例 (実カードで判明したら更新) を明示。
- **Type consistency:** inline `a2`/`a3` は `AbilityDef`、`sceneSetState`/`draw` verb + 短縮形 args は ATOM_PICK_SPEC 既存。`hook:'evidence:remove-by-action'` は factory と同一。
