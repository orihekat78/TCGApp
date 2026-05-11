# Phase 0: プロジェクトブートストラップ

> **Engineer note:** これはコード実装の前段階。npm/Vite/Vitest/TypeScript/React の足場を作る。TDD は Phase 1 から。

**Goal:** TypeScript + Vite + React + Vitest が動く空プロジェクトを作る。`npm test` で空テストが通る。`npm run dev` で空白ページが表示される。

**Files (新規):**
- `package.json` / `tsconfig.json` / `vite.config.ts` / `vitest.config.ts`
- `index.html` / `src/main.tsx` / `src/App.tsx`
- `tests/sanity.test.ts`
- `.gitignore` / `.eslintrc.cjs` / `.prettierrc`

---

### Task 0.1: npm init + 依存追加

- [ ] **Step 1:** `npm init -y` 実行
- [ ] **Step 2:** dev依存追加: `npm i -D typescript @types/react @types/react-dom @types/node vite @vitejs/plugin-react vitest @vitest/ui jsdom immer eslint prettier`
- [ ] **Step 3:** prod依存: `npm i react react-dom zustand`
- [ ] **Step 4:** 動作確認 `node -v` `npm -v` `npx tsc -v`

### Task 0.2: tsconfig + vite + vitest 設定

- [ ] **Step 1:** `tsconfig.json` 作成 (target ES2022, module ESNext, strict, jsx react-jsx, paths `"@/*": ["src/*"]`)
- [ ] **Step 2:** `vite.config.ts` 作成 (react plugin, alias `@` → `src`)
- [ ] **Step 3:** `vitest.config.ts` 作成 (environment: jsdom, globals: true)
- [ ] **Step 4:** `package.json` scripts: `dev`, `build`, `test`, `test:ui`, `lint`, `typecheck`

### Task 0.3: 最小 React アプリ

- [ ] **Step 1:** `index.html` (root div + script src=src/main.tsx)
- [ ] **Step 2:** `src/main.tsx` (createRoot + App)
- [ ] **Step 3:** `src/App.tsx` (`<h1>名探偵コナンTCG (MVP)</h1>` のみ)
- [ ] **Step 4:** `npm run dev` で localhost:5173 が表示されることを確認

### Task 0.4: sanity test

- [ ] **Step 1:** `tests/sanity.test.ts` 作成:

```typescript
import { describe, it, expect } from 'vitest';
describe('sanity', () => {
  it('vitest works', () => { expect(1+1).toBe(2); });
});
```

- [ ] **Step 2:** `npm test` で PASS 確認
- [ ] **Step 3:** `npm run typecheck` 通過確認

### Task 0.5: .gitignore + 初回コミット

- [ ] **Step 1:** `.gitignore` (`node_modules`, `dist`, `coverage`, `.env`, `.tmp`)
- [ ] **Step 2:** `git init` (まだなら) + `git add -A` + `git commit -m "feat: bootstrap TypeScript+Vite+Vitest+React"`

### Task 0.6: ディレクトリ骨格

- [ ] **Step 1:** 空ディレクトリ作成 (gitkeep 含む):
  - `src/engine/` (read/, mutate/, effect/, event/, cost/, target/, cond/, flow/, resolve/, types/)
  - `src/cards/_shared/`, `src/cards/ct-d08/`, `src/cards/ct-d11/`
  - `src/ui/components/`, `src/ui/state/`, `src/ui/hooks/`
  - `src/ai/`
  - `tests/engine/`, `tests/cards/`, `tests/ai/`, `tests/integration/`
- [ ] **Step 2:** コミット `chore: scaffold directory layout`

## 完了基準

- [x] `npm test` が PASS
- [x] `npm run dev` が起動
- [x] `npm run typecheck` 通過
- [x] git に2コミット (`bootstrap` + `scaffold`)

→ Phase 1 へ
