# HOME Landscape 20/80 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce the approved 851x393 HOME image with a fixed 20/80 rail-to-deck ratio while retaining the desktop composition.

**Architecture:** Keep the existing HOME DOM and data flow unchanged. Add a landscape-compact CSS layer that reduces header, typography, spacing, and card presentation without moving NEWS or match history out of the left rail.

**Tech Stack:** React, TypeScript, CSS Grid, Playwright.

## Global Constraints

- Change HOME presentation only; do not change MATCH, playmat, game rules, routes, stores, or official NEWS behavior.
- At 851x393, `.home-rail` and `.home-deck-stage` remain side by side at 1:4.
- NEWS and recent matches remain in the single left rail.
- Keep all seven navigation labels visible on one row.
- No horizontal overflow or clipped card art.

---

### Task 1: Lock the approved compact landscape composition

**Files:**
- Modify: `meta-app/tests/e2e/home.spec.ts`
- Modify: `meta-app/src/styles/meta.css`

**Interfaces:**
- Consumes: Existing `.home-main`, `.home-rail`, `.home-deck-stage`, `.home-navigation`, and identity-card markup.
- Produces: A CSS-only 851x393 HOME layout with a 1:4 grid ratio.

- [x] **Step 1: Write the failing browser test**

Add an 851x393 assertion that computes rail and stage widths, requires `3.8 <= stage / rail <= 4.2`, verifies both rail sections are visible, verifies both figures remain side by side, and checks horizontal overflow.

- [x] **Step 2: Run the focused test to verify RED**

Run: `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/home.spec.ts --grep "approved 20/80"`

Expected: FAIL because the current 851x393 vertical density does not match the approved composition.

- [x] **Step 3: Implement the compact landscape CSS**

Add a HOME-scoped `@media (max-width: 900px) and (orientation: landscape)` layer. Keep `grid-template-columns: minmax(0, 1fr) minmax(0, 4fr)` and apply the approved compact header, rail rows, card frames, captions, and spacing.

- [x] **Step 4: Run focused checks to GREEN**

Run the focused Playwright test, then the complete HOME E2E file and focused HOME component tests.

- [x] **Step 5: Visual verification**

Capture 851x393 and 1440x900 screenshots, inspect overlap/crop/overflow and console errors, then open the verified 851x393 HOME in the in-app browser.
