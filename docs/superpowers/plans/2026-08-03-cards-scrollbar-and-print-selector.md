# CARDS Scrollbar and Print Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match HOME scrollbars on CARDS and show every same-card print without a nested horizontal scroller.

**Architecture:** Extend HOME's existing CSS selector group to vertically scrolling CARDS regions. Keep `variantsOfId()` and selection state unchanged; reshape `SelectedDetail` with dense wrapping chips meeting the 24px WCAG minimum. Populate incident-card first/second values from a generated official-data map.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Playwright.

## Global Constraints

- Preserve card ordering, dimensions, filters, focus behavior, and `851x393` layout.
- Reuse HOME values exactly: thin, 5px, `rgba(121, 212, 236, 0.55)`, transparent track.
- No new dependency, glow, gold scrollbar, animation, or game-state change.
- Print chips meet 24px minimum targets, use compact spacing, and retain keyboard access.
- No print-row chevron or horizontal scrollbar. Every print number is always rendered.

---

### Task 1: Lock behavior with failing tests

**Files:**
- Modify: `tests/meta/CardsScreen.test.tsx`
- Modify: `meta-app/tests/e2e/cards.spec.ts`

**Interfaces:**
- Consumes: `SelectedDetail`, `variantsOfId()`, HOME scrollbar CSS.
- Produces: regression coverage for parity, complete print order, wrapping, and card-specific incident values.

- [ ] **Step 1: Add unit failures for complete print display**

Render `CardsScreen`, search `B09001`, and assert every matching `CARD_POOL` print appears in canonical order, every chip selects directly, and `次の別イラスト` is absent. Also prove effect text remains without the visible `EFFECT · 効果` heading, and lock the partner/incident/event stat contracts including `B09107P = 先攻0枚 / 後攻0枚`.

- [ ] **Step 2: Add browser failures for layout and scrollbar parity**

Assert `.cards-print-selector` precedes `.cards-selected-identity`; the `別イラスト` text and next button are absent; all chips wrap without horizontal overflow or clipping. Compare HOME scrollbars against `.cards-grid-scroll`, `.cards-selected-scroll`, and `.cards-filter-scroll`; explicitly exclude `.cards-print-strip`.

- [ ] **Step 3: Run RED probes**

Run `npx vitest run tests/meta/CardsScreen.test.tsx` and isolated `cards.spec.ts`; expect complete-print, incident-data, and wrapping assertions to fail.

### Task 2: Reuse the HOME scrollbar contract

**Files:**
- Modify: `meta-app/src/styles/meta.css:286-308,1643-1719,1778-1788`

**Interfaces:**
- Consumes: existing HOME scrollbar declarations.
- Produces: identical style on all CARDS scroll containers.

- [ ] **Step 1: Expand the shared selector group**

Add `.cards-grid-scroll`, `.cards-list-scroll`, `.cards-selected-scroll`, and `.cards-filter-scroll` to the HOME scrollbar rules. Give WebKit scrollbars both `width: 5px` and `height: 5px`. Do not style `.cards-print-strip` as a scroll container.

- [ ] **Step 2: Preserve mechanics**

Keep each region's existing `overflow`, `overscroll-behavior`, and `scrollbar-gutter`; do not hide native end markers.

- [ ] **Step 3: Verify the shared CSS contract**

Confirm every named vertical CARDS region inherits the exact HOME declarations.

### Task 3: Build the approved print selector

**Files:**
- Modify: `meta-app/src/screens/CardsScreen.tsx:464-548`
- Modify: `meta-app/src/styles/meta.css:1704-1719,1847-1855`

**Interfaces:**
- Consumes: `variantsOfId(card.id)` and `onSelectVariant(num: string)`.
- Produces: `.cards-print-selector`, wrapping `.cards-print-strip`, and `.cards-print-chip`.

- [ ] **Step 1: Move selector above identity**

Render the selector after card art and before `.cards-selected-identity`. Remove the visible `別イラスト` label while retaining an accessible group label. Remove only the visible `EFFECT · 効果` heading and preserve `card.effectShort` verbatim. Show partner LP only, official card-specific incident first/second counts only, event cost only, and keep character stats unchanged.

- [ ] **Step 2: Show every print directly**

Map every result of `variantsOfId(card.id)` to a numbered button. Delete the next-print action, active-chip auto-scroll, and horizontal overflow.

- [ ] **Step 3: Match the approved visual**

Use compact numbered inner chips with cyan active state and subdued inactive borders. Wrap onto additional rows. Keep each outer button at least 24px in both dimensions. Pointer selection removes the outer focus rectangle; keyboard focus retains it.

- [ ] **Step 4: Run focused GREEN tests**

Run the focused Vitest and Cards Playwright files; expect all assertions to pass at desktop and `851x393`.

### Task 4: Final gates and review

**Files:** all files above plus the approved spec and this plan.

- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build:meta`.
- [ ] Run `git diff --check` and verify browser console errors are zero.
- [ ] Capture desktop and `851x393` screenshots with print selector and filter drawer visible.
- [ ] Run read-only visual, UX, horizontal-regression, and final adversarial reviews; resolve every Critical/Important finding.
