# iPhone SE 3 Landscape UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the approved dense mobile reference at `851x393` and iPhone SE 3 `667x375`, including a smaller legible sync pill and the strongest truthful landscape behavior available to the browser.

**Architecture:** Keep one desktop composition and bounded card windows. Compact CSS and explicit viewport contracts adapt HOME, DECK, CARDS, and MATCH; the top-level landscape gate remains the sole orientation authority and only unlocks after observed landscape.

**Tech Stack:** React 19, TypeScript, CSS, Screen Orientation API, Fullscreen API, Vitest, Playwright.

## Global Constraints

- Work and commit directly on clean `main`; do not add a second mobile board or mount more than `min(totalMatches,96)` catalog tiles.
- Card art stays contained with fallback art; no bundled/server-hosted official images. Interactive targets remain at least 44 CSS pixels.
- Never claim an iOS OS lock guarantee. A resolved API call is not landscape proof; unsupported/rejected/unobserved paths keep the blocking rotation gate.
- Keep evidence labels separate: Chromium viewport simulation, desktop Playwright WebKit, and physical iPhone Safari. Only the third can verify the real device; never upgrade desktop WebKit to physical-iOS proof.

---

### Task 1: Compact, legible sync indicator

**Files:** Modify `meta-app/src/shared/NetworkStatus.tsx`, `meta-app/src/shared/CloudSyncIndicator.tsx`, `meta-app/src/styles/meta.css`, `tests/meta/cloudSyncIndicator.test.tsx`, `meta-app/tests/e2e/home.spec.ts`.

**Interface:** Add `compact?: boolean` to `NetworkStatus`; `CloudSyncIndicator` requests it.

- [ ] RED: compact class, complete accessible phase name, safe-area placement, no pointer target, and visible primary status text at least 10px. Secondary copy may be visually hidden on SE while remaining in the accessible name.
- [ ] At `667x375`, require at most 112x22 CSS pixels, full viewport containment, and no overlap with identity-card captions.
- [ ] Replace inline geometry with classes: 4px gap/dot, 2px 6px padding, 8px radius, compact letter spacing, and safe-area right/bottom. Preserve `role=status`, `aria-live=polite`, title, and phase data.
- [ ] Run `npx vitest run tests/meta/cloudSyncIndicator.test.tsx --maxWorkers=1` and `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/home.spec.ts --workers=1`; expect PASS. Commit `fix(meta): compact mobile sync status`.

### Task 2: Formal SE3 layout and bounded catalogs

**Files:** Modify `tests/ui/hooks/useStageScale.test.ts`, `meta-app/tests/e2e/home.spec.ts`, `meta-app/tests/e2e/cards-deck-wave1.spec.ts`, `meta-app/tests/e2e/cards.spec.ts`, `meta-app/tests/e2e/deck.spec.ts`, `tests/e2e/mobile-viewport-controls.spec.ts`; modify `meta-app/src/styles/meta.css` only after witnessed overflow.

**Consumes / Produces:** Consume exact viewport/filter/scroll states; produce bounded DOM and measured no-overflow evidence without changing desktop composition.

- [ ] RED exact live MATCH geometry at `667x375` in `mobile-viewport-controls.spec.ts`: contained landscape, scale `375/1080`, rendered size about `666.667x375`, symmetric gutters about `0.167px`, zero page overflow, all fixed controls in viewport, and all interactive hit targets at least 44px.
- [ ] RED HOME/DECK/CARDS at `851x393` and `667x375`: 54px header, zero horizontal overflow, no clipped fixed controls, contained art, stable aspect ratio, and detail continuity.
- [ ] For unfiltered catalogs with at least 48 matches, initial mounted count is exactly 48. In every empty/filtered/scrolled state assert `mounted <= min(totalMatches,96)`, including fewer-than-48, repeated scroll/filter, selected/focused pins, and detail return.
- [ ] Require every visible interactive control at least 44px, primary labels/status at least 10px, and supporting metadata at least 8px; only the noninteractive pill's target-size rule is exempt.
- [ ] Record each pre-fix failing selector/bounds pair. Patch only witnessed owners in one `@media (max-width:720px) and (max-height:390px) and (orientation:landscape)` block: `min-height:0`, internal scrolling, safe-area padding, and `object-fit:contain`; hide no functions.
- [ ] Run `npx vitest run tests/ui/hooks/useStageScale.test.ts --maxWorkers=1`, `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/home.spec.ts meta-app/tests/e2e/cards-deck-wave1.spec.ts meta-app/tests/e2e/cards.spec.ts meta-app/tests/e2e/deck.spec.ts --workers=1`, `npx playwright test tests/e2e/mobile-viewport-controls.spec.ts --workers=1`, and `npm run typecheck`; expect PASS. Commit `fix(meta): certify iPhone SE landscape layouts`.

### Task 3: Strongest truthful landscape gate

**Files:** Modify `tests/meta/useLandscapeExperience.test.tsx`, `tests/meta/LandscapeGate.test.tsx`, `meta-app/tests/e2e/landscape-gate.spec.ts`; modify `meta-app/src/hooks/useLandscapeExperience.ts`, `meta-app/src/shared/LandscapeGate.tsx` only after RED.

**Consumes / Produces:** Consume API outcome plus observed orientation; produce truthful gate state, hidden/inert recovery state, and deterministic focus ownership.

- [ ] RED: `requestFullscreen()` then `screen.orientation.lock('landscape')` resolving while viewport remains portrait does not report entered. Unlock only after `matchMedia`/viewport observes landscape.
- [ ] RED cold portrait: route content is unmounted. After first landscape, a later portrait keeps route state mounted but hidden, inert, and `aria-hidden`; returning landscape restores a connected prior focus or the content fallback.
- [ ] RED missing APIs and lock/fullscreen rejection: instructions remain visible, focus trapped, state preserved, and copy never promises an OS lock.
- [ ] Simulated Chromium flow `375x667 -> 667x375`: HOME -> DECK -> SETUP -> MATCH, rotate away/back, preserve route/draft/pending state and focus. Run desktop WebKit separately if installed. Record both as non-device evidence; physical iPhone Safari remains unverified without a device run.
- [ ] Run `npx vitest run tests/meta/useLandscapeExperience.test.tsx tests/meta/LandscapeGate.test.tsx --maxWorkers=1` and `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/landscape-gate.spec.ts --workers=1`; expect PASS. Commit `fix(meta): report only observed landscape entry`.

### Task 4: Visual and release gates

**Files:** Create `.claude/reports/2026-08-12-iphone-se3-landscape/visual-qa.md` and screenshots `.claude/reports/2026-08-12-iphone-se3-landscape/{before,after}-{851x393,667x375}.png`. Modify generated `.claude/auto/**` only through `npm run docs` if reported changed.

**Consumes / Produces:** Consume fresh screenshots and gate logs; produce a <=100-line visual QA report and generator-owned docs only.

- [ ] Capture before/after `851x393` and `667x375` screenshots under `.claude/reports/2026-08-12-iphone-se3-landscape/visual-qa.md`; record hierarchy, crop, safe-area, legibility, hit-targets, reference alignment, and separate Chromium/WebKit/physical-iPhone evidence status.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build:meta`, `npx vitest run tests/meta/cloudSyncIndicator.test.tsx tests/ui/hooks/useStageScale.test.ts tests/meta/useLandscapeExperience.test.tsx tests/meta/LandscapeGate.test.tsx --maxWorkers=1`, `npm run test:meta:e2e`, `npm run test:e2e:private-hosted`, `npm run docs`, `npm run docs:check`, and `git diff --check origin/main...HEAD`.
- [ ] Request read-only product-design, UX, visual-QA, and adversarial reviews; fix every Critical/Important finding with a browser RED; inspect all compact/short-height modal and catalog consumers horizontally.
- [ ] Never hand-edit `.claude/auto/**`. Commit `visual-qa.md`, four screenshots, and only generator-changed files as `docs: record iPhone landscape verification`; confirm clean `main`.
