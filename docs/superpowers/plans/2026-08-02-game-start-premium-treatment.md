# Game Start Premium Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HOMEヘッダーのゲーム開始ボタンを、デスクトップとモバイル共通の深い青のラッカー表現へ変更する。

**Architecture:** 既存の`home-nav-start`を唯一のスタイル境界として使い、DOMと遷移契約は維持する。疑似要素で上面反射を加え、既存のレスポンシブ規則とreduced-motion規則へ適合させる。

**Tech Stack:** React、TypeScript、CSS、Playwright

## Global Constraints

- ボタンの位置、文言、遷移先を変更しない。
- デスクトップとモバイルで同じ素材表現を使用する。
- 金色、粒子、常時点滅、強いグロー、連続する光の走査は使わない。
- コミットはユーザーから依頼されるまで行わない。

---

### Task 1: Premium game-start states

**Files:**
- Modify: `meta-app/tests/e2e/home.spec.ts`
- Modify: `meta-app/src/styles/meta.css`

**Interfaces:**
- Consumes: `.home-nav-start`、既存HOMEナビゲーションDOM
- Produces: 通常、hover、focus-visible、active、reduced-motionに対応する共通ボタン表現

- [ ] **Step 1: Write the failing visual-contract test**

`home.spec.ts`へ、1440pxと851pxの両方で`.home-nav-start`の疑似要素、濃色背景、明示的なtransitionを検査するテストを追加する。

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:meta:e2e -- --grep "premium game-start"`

Expected: `::before`の`content`または背景契約が未実装のためFAIL。

- [ ] **Step 3: Implement the minimal CSS**

`meta.css`の`.home-nav-start`へ`position`、`overflow`、深い青の多層背景、銀青の輪郭、上面反射、控えめな影を追加する。hoverは1px浮上、activeは原位置、focus-visibleは外側輪郭を付ける。モバイル規則は寸法だけ上書きし、素材規則を再定義しない。

- [ ] **Step 4: Run focused and HOME regression tests**

Run: `npm run test:meta:e2e -- --grep "HOME|premium game-start"`

Expected: PASS。1440x900と851x393で文字切れ、重なり、横overflowなし。

- [ ] **Step 5: Run repository gates and visual review**

Run: `npm run typecheck`, `npm run lint`, `npm run docs:check`。
デスクトップと851x393のスクリーンショットを更新し、Visual QAで比較する。

### Task 2: Shared desktop and mobile navigation labels

**Files:**
- Modify: `meta-app/tests/e2e/home.spec.ts`
- Modify: `meta-app/src/screens/HomeScreen.tsx`
- Modify: `meta-app/src/styles/meta.css`

**Interfaces:**
- Consumes: `NAV_ITEMS`の7項目と既存ナビゲーション順序
- Produces: デスクトップ・モバイルで常時表示される同一ナビゲーション

- [ ] **Step 1: Replace compact menu expectations with the shared-header contract**

851x393と320x568で7項目が同じ順序・文言で表示され、モバイル専用メニューが存在しないことをE2Eへ記述する。

- [ ] **Step 2: Run HOME E2E and verify RED**

Run: `npm run test:meta:e2e -- home.spec.ts`

Expected: 現行のモバイル規則が6項目を隠し、メニューボタンを表示するためFAIL。

- [ ] **Step 3: Remove menu state and make responsive navigation persistent**

`HomeScreen`からモバイルメニュー用state、refs、Escape処理、トグルボタンを削除する。851pxでは1行、720px以下では全項目を複数行へ再構成し、文字を省略しない。

- [ ] **Step 4: Run HOME E2E and quality gates**

Run: `npm run test:meta:e2e -- home.spec.ts`, `npm run typecheck`, `npm run lint`, `npm run build:meta`。

- [ ] **Step 5: Capture both viewports and repeat independent Visual QA**

1440x900、851x393、640x800、320x568を更新し、項目欠落、切れ、重なり、横overflowがないことを確認する。
