# HOME Deck Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HOMEで使用デッキを確認後に変更し、その選択を次の対戦へ反映する。

**Architecture:** `decksStore`が有効な`activeDeckId`を永続管理する。HOME固有のdialogが仮選択を保持し、確定時だけstoreへ書き、HOMEとSETUPが同じIDを読む。

**Tech Stack:** React 19, TypeScript, Zustand persist, Vitest, Playwright, CSS

## Global Constraints

- 既存HOMEの20:80構成とMATCHのプレイマットを変更しない。
- デスクトップと`851x393`で同じ2列・同じ文言を維持する。
- 縦横の事件カードを切り抜かず、対戦不可能なデッキを選択させない。
- TDD、キーボード、reduced-motion、横overflowゼロを必須とする。

---

### Task 1: 使用デッキ状態

**Files:** Modify `meta-app/src/state/decksStore.ts`; test `tests/meta/decksStore.test.ts`

**Interfaces:** Produce `activeDeckId: string`, `setActiveDeck(id: string): void`; consume `isPlayable(deck)`.

- [ ] RED: 有効IDの保存、無効ID拒否、version 3 migration、削除・更新時復旧を失敗テストにする。
- [ ] Run `npx vitest run tests/meta/decksStore.test.ts`; expect missing state/action failures.
- [ ] GREEN: version 4 migrationと全更新経路の`activeDeckId`正規化を実装する。
- [ ] Run the focused test; expect PASS.

### Task 2: HOMEモーダル

**Files:** Create `meta-app/src/screens/HomeDeckSelectorDialog.tsx`; modify `HomeScreen.tsx`, `meta.css`; test `HomeScreen.test.tsx`.

**Interfaces:** Consume `decks`, `activeDeckId`, `setActiveDeck`; produce `onConfirm(id)` and `onClose()` dialog behavior.

- [ ] RED: ボタンでdialog表示、正式名表示、仮選択、確定、全キャンセル経路を失敗テストにする。
- [ ] Run `npx vitest run tests/meta/HomeScreen.test.tsx`; expect dialog/selection failures.
- [ ] GREEN: native dialog、radio項目、CardArt、2列CSS、フォーカス復帰を実装する。
- [ ] Run the focused test; expect PASS.

### Task 3: SETUP連携

**Files:** Modify `meta-app/src/screens/SetupScreen.tsx`; test `tests/meta/SetupScreen.lifecycle.test.tsx`.

**Interfaces:** Consume `activeDeckId`; preserve existing `customGameStart(selfDeck, oppDeck, options)`.

- [ ] RED: HOMEで選んだIDがSETUPの自分側初期値になる失敗テストを追加する。
- [ ] Run the focused Setup test; expect first deck mismatch.
- [ ] GREEN: `selfDeckId`初期値を有効な`activeDeckId`から決定する。
- [ ] Run the focused test; expect PASS.

### Task 4: 画面と回帰検証

**Files:** Modify `meta-app/tests/e2e/home.spec.ts`, `.claude/memory.md`.

**Interfaces:** Exercise public HOME→dialog→SETUP flow at `1440x900` and `851x393`.

- [ ] RED: 確定前不変、確定後HOME/SETUP反映、Escape、scroll、overflowのE2Eを追加する。
- [ ] Run the focused Playwright file; expect missing dialog behavior.
- [ ] GREEN: 発見した表示・操作差分だけ修正する。
- [ ] Run typecheck, lint, META build, full Vitest, focused Playwright, diff check.
- [ ] Run product, UX, visual, adversarial reviews; Critical/Importantゼロにする。
