# CARDS Landscape Compact-Grid Implementation Plan

> Updated after visual review: 851x393 uses seven columns. 720px and below keep five.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CARDS `851x393` landscape layout show seven cards per row and a readable selected-card inspector.

**Architecture:** Keep the existing CARDS component tree. Use width-bounded landscape CSS for seven or five columns and orientation-aware inspector art dimensions.

**Tech Stack:** React, TypeScript, CSS, Playwright, Vitest.

## Global Constraints

- Preserve desktop layout, header, toolbar, filter, print selector, and card ratios.
- Supported compact landscape (`667px` through `900px`) keeps at least five cards
  on its first row; desktop may show more.
- No screen-level horizontal or vertical overflow.
- Shared navigation never overlaps CARDS content at `667x375`.
- Search and print variants expose at least `44x44px` hit areas.
- Inspector body scrolls independently; favorite remains reachable.
- No new dependency and no engine or card-rule change.

---

### Task 1: Responsive contract test

**Files:**
- Modify: `meta-app/tests/e2e/cards.spec.ts`

**Interfaces:**
- Consumes: `.cards-card-grid`, `.cards-grid-item`, `.cards-selected-art`.
- Produces: a failing E2E contract for seven columns at 851x393 and readable inspector art.

- [x] Add assertions that the first seven grid items share one row at `851x393`.
- [x] Assert item six starts the next row and screen overflow remains zero.
- [x] Select a landscape case and assert inspector art width is at least `110px`.
- [x] Run `npm run test:meta:e2e -- cards.spec.ts` and confirm the new assertions fail for four columns and undersized art.

### Task 2: Orientation-aware responsive layout

**Files:**
- Modify: `meta-app/src/shared/MetaCard.tsx`
- Modify: `meta-app/src/styles/meta.css`

**Interfaces:**
- Produces: `data-card-orientation="portrait|landscape"` on `MetaCard`.
- Consumes: the attribute in CARDS compact-grid ratio rules and selected-art CSS.

- [x] Add the orientation data attribute without changing existing card behavior.
- [x] Set 721px through 900px to seven columns; preserve five at 720px and below.
- [x] Replace the `0.255` inspector transform with a stable `140x115px` stage and orientation-aware art dimensions.
- [x] Run the focused E2E and confirm it passes.
- [x] Run CardsScreen unit tests, typecheck, lint, CARDS E2E, build, and full Vitest.
- [x] Capture `1440x900` and `851x393`; verify console errors, focus, ratios, and overflow.
- [x] Obtain UX, visual, and adversarial review with Critical/Important zero.

### Task 3: Compact interaction remediation

**Files:**
- Modify: `meta-app/src/screens/CardsScreen.tsx`
- Modify: `meta-app/src/styles/meta.css`
- Modify: `meta-app/tests/e2e/cards.spec.ts`

- [x] Prove the `667x375` header cannot intercept the first card or inspector.
- [x] Give search and enabled print variants `44x44px` hit areas.
- [x] Keep selected card name, current print, and `別イラスト (N)` visible.
- [x] Re-run compact, desktop, keyboard, console, and full regression gates.
