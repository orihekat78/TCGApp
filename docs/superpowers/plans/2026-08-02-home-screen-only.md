# HOME Screen Only Implementation Plan

> **For Codex:** Execute with strict TDD. Keep MATCH/playmat and non-HOME screen content unchanged. Later user direction removes the development `NavHUD` from every Meta route.

**Goal:** Replace the meta-app HOME with the approved deck-identity layout, responsive navigation, and safe official NEWS synchronization.

**Architecture:** HOME owns a dedicated semantic header and open 20/80 layout. The first persisted deck remains the same default used by SETUP. A small NEWS boundary parses public official metadata, validates links, caches the last successful payload, and never renders remote HTML.

**Tech Stack:** React, TypeScript, Zustand, CSS, Vitest/jsdom, Playwright, Vite.

---

## Task 1: Official NEWS boundary

**Files:**
- Create: `meta-app/src/services/officialNews.ts`
- Create: `meta-app/src/hooks/useOfficialNews.ts`
- Test: `tests/meta/officialNews.test.ts`

1. Add failing table tests for normalized title/category/date/URL, duplicate removal, exact Takara Tomy HTTPS allowlist, malformed HTML, stale cache fallback, and six-hour freshness.
2. Run the focused test and confirm failure because the service does not exist.
3. Implement DOMParser-based text extraction, bounded fields, stable URL IDs, versioned localStorage cache, timeout/cancellation, and stale-while-revalidate hook behavior.
4. Run the focused test to green, then refactor without changing the boundary.

## Task 2: HOME content and navigation

**Files:**
- Replace: `meta-app/src/screens/HomeScreen.tsx`
- Modify: `meta-app/src/App.tsx`, `meta-app/src/shared/index.ts`
- Delete: `meta-app/src/shared/NavHUD.tsx`
- Create: `tests/meta/HomeScreen.test.tsx`
- Add asset: `meta-app/src/assets/detective-conan-logo.png`

1. Add failing DOM tests for the exact seven-item header order, logo accessible name, sole new-game entry in the header, first deck identity, partner and incident accessible names, and absence of removed labels/CTA.
2. Add failing behavior tests proving every internal control calls `onNav`, NEWS links stay on the approved official host, and Resume is absent without a persisted resumable session.
3. Run the focused tests and confirm the expected failures.
4. Implement semantic HOME markup. Use the supplied logo and existing `CardArt` image pipeline; contain portrait/landscape incidents without crop or stretch; use the first deck to match SETUP's current default.
5. Render official NEWS metadata and recent matches as open sections, not nested cards. Keep “使用デッキを変更” secondary. Do not invent resumable state.
6. Run focused tests to green.

## Task 3: Responsive visual system

**Files:**
- Modify: `meta-app/src/styles/meta.css`
- Modify: `meta-app/tests/e2e/smoke.spec.ts`

1. Add failing E2E assertions for HOME at 1440×900 and 851×393: no overflow, 20/80 desktop structure, side-by-side card identity, 44px controls, and exact navigation order.
2. Implement HOME-scoped CSS: restrained navy surfaces, neutral text, cyan only for state/action, desktop 20/80 grid, compact drawer, side-by-side contained media, visible focus, reduced-motion support, and one intentional page scroll for short viewports.
3. Verify both incident orientations by controlled card fixtures or component coverage; never stretch or crop.
4. Run focused unit and E2E tests to green.

## Task 4: Quality gates and adversarial review

**Files:** all changed HOME files and structurally similar navigation/card/news consumers.

1. Run typecheck, lint, focused Vitest, full Vitest, meta build, and HOME E2E.
2. Capture desktop 1440×900 and compact 851×393 screenshots from the public HOME route. Check console, keyboard order, overflow, and visible focus.
3. Run product-design, UX, regression, visual-QA, and adversarial code reviews. Fix all Critical/Important findings and rerun affected gates.
4. Run documentation generation/checks if source inventory changed and inspect the complete diff.
