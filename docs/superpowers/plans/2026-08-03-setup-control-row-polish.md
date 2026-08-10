# SETUP Control Row Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement approved B-style separated setup rows with gamepad, die, and robot icons.

**Architecture:** Keep `SetupScreen` state and native selects unchanged. Add decorative inline SVG icons inside each control row and express the approved hierarchy entirely through scoped SETUP CSS.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Playwright.

## Global Constraints

- Keep desktop and horizontal `851x393` composition identical.
- Preserve native select labels, values, and start behavior.
- Keep every interactive control at least 44px high.
- Do not add an icon dependency or commit unless the user requests it.

---

### Task 1: Add semantic control-row icons

**Files:**
- Modify: `meta-app/src/screens/SetupScreen.tsx`
- Test: `tests/meta/SetupScreen.lifecycle.test.tsx`

**Interfaces:**
- Consumes: existing `SelectControl` props and native select behavior.
- Produces: `SetupControlIcon({ name })` and `.setup-control-icon[data-icon]`.

- [x] **Step 1: Write the failing structural test**

Assert three `.setup-control-icon` elements exist in order with `data-icon`
values `mode`, `first`, and `cpu`, are `aria-hidden`, and the start button stays
directly under the three controls.

- [x] **Step 2: Verify the focused test fails**

Run: `npm test -- --run tests/meta/SetupScreen.lifecycle.test.tsx`
Expected: FAIL because no `.setup-control-icon` exists.

- [x] **Step 3: Implement minimal inline SVG icons**

Extend `SelectControl` with `icon: 'mode' | 'first' | 'cpu'`. Render an
`aria-hidden` SVG: gamepad for `mode`, die for `first`, robot head for
`cpu`. Do not change `label`, `value`, `onChange`, or `disabled` behavior.

- [x] **Step 4: Verify the focused test passes**

Run: `npm test -- --run tests/meta/SetupScreen.lifecycle.test.tsx`
Expected: 16 tests pass.

### Task 2: Apply B-style visual hierarchy and responsive proof

**Files:**
- Modify: `meta-app/src/styles/meta.css`
- Modify: `meta-app/tests/e2e/setup-refresh.spec.ts`

**Interfaces:**
- Consumes: `.setup-control-icon`, `.setup-select-control`, `.setup-start`.
- Produces: separated icon/label/value rows with no enclosing panel.

- [x] **Step 1: Write failing visual-contract assertions**

At `1440x900` and `851x393`, assert icon count/order, icon visibility, no
horizontal overflow, 44px control height, and start below CPU difficulty.

- [x] **Step 2: Verify Playwright fails before styling**

Run: `PLAYWRIGHT_META_PORT=5229 npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/setup-refresh.spec.ts`
Expected: FAIL on icon geometry or missing style.

- [x] **Step 3: Implement the approved B styling**

Use separate translucent rows, an icon column, muted labels, brighter values,
restrained borders, and the existing cyan start action. Compact landscape keeps
the same columns with smaller gaps and unchanged 44px hit areas.

- [x] **Step 4: Run focused and repository gates**

Run lifecycle Vitest, the four SETUP Playwright specs, full Vitest, typecheck,
lint, `build:meta`, `docs`, `docs:check`, and `git diff --check`. Expected: PASS.

- [x] **Step 5: Review live UI**

Reload `http://127.0.0.1:5212/#setup`; inspect desktop and `851x393`, console,
focus, clipping, and the PLAYER/CPU visual balance.
