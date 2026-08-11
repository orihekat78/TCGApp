# Windowed Card Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep DECK and CARDS at 48 initial and 96 maximum mounted cards.

**Architecture:** A dependency-free hook calculates a measured two-chunk window and spacers. Screen adapters retain their existing filters, selection, focus, and deck state.

**Tech Stack:** React 19, TypeScript, ResizeObserver, Vitest, Playwright.

## Global Constraints

- Full metadata remains searchable in memory; only rendered tiles are windowed.
- Never append indefinitely, fix card height, change deck rules, or prefetch images.
- Production code follows a witnessed RED test and uses `apply_patch`.

---

### Task 1: Window range owner

**Files:**
- Create: `meta-app/src/hooks/useWindowedCollection.ts`
- Create: `tests/meta/useWindowedCollection.test.tsx`

**Interfaces:**
- Produces: `useWindowedCollection<T>(options)` returning `visibleItems`, `start`, `end`, `beforePx`, `afterPx`, `registerItem`, and `reveal`.
- Defaults: `initialItems=48`, `maxMountedItems=96`; keys come from `getKey`.

- [ ] Write RED tests proving initial `[0,48)`, scroll range `<=96`, measured variable rows, reset on `layoutKey`, selected/focused key pinning, and `reveal(key,{focus:true})`.
- [ ] Run `npx vitest run tests/meta/useWindowedCollection.test.tsx --maxWorkers=1`; expect missing-module failure.
- [ ] Implement measured columns/rows with `ResizeObserver`, two 48-item chunks, spacer heights, focus restoration, and cleanup.
- [ ] Re-run the test; expect PASS with no leaked observer/listener warnings.
- [ ] Commit `test+hook` as `feat(meta): add bounded card catalog window`.

Core result shape:

```ts
interface WindowedCollection<T> {
  start: number; end: number; visibleItems: readonly T[];
  beforePx: number; afterPx: number;
  registerItem(index: number): (node: HTMLElement | null) => void;
  reveal(key: string, options?: { focus?: boolean }): void;
}
```

Primary RED assertion:

```ts
const first = screen.getAllByTestId(/^deck-pool-card-/)[0]!;
expect(screen.getAllByTestId(/^deck-pool-card-/)).toHaveLength(48);
fireEvent.scroll(scroller, { target: { scrollTop: 20_000 } });
expect(screen.getAllByTestId(/^deck-pool-card-/).length).toBeLessThanOrEqual(96);
expect(first).not.toBeConnected();
```

### Task 2: CARDS integration

**Files:**
- Modify: `meta-app/src/screens/CardsScreen.tsx:69-150,333-384`
- Modify: `meta-app/src/styles/meta.css:2142-2173,2534-2564`
- Modify: `tests/meta/CardsScreen.test.tsx`

- [ ] Add RED component tests: 48 initial cards, distant first card unmounted after scroll, at most 96 cards, filter/view reset, selected print retained.
- [ ] Run `npx vitest run tests/meta/CardsScreen.test.tsx --maxWorkers=1`; expect the mounted-count assertion to receive the full catalog.
- [ ] Wire grid and list scroll containers to the hook; render full-width inert spacers and the returned slice; keep result count based on `filtered`.
- [ ] Re-run the focused hook and CARDS tests; expect PASS.
- [ ] Commit as `fix(meta): window the card library`.

### Task 3: DECK integration and performance regression

**Files:**
- Modify: `meta-app/src/screens/DeckEditor.tsx:867-956`
- Modify: `meta-app/src/styles/meta.css:3056-3069,3605-3608`
- Modify: `meta-app/tests/e2e/cards-deck-wave1.spec.ts`
- Modify: `meta-app/tests/e2e/deck.spec.ts`
- Modify: `.claude/specs/meta-ui/07-screens-library.md:63-66`

- [ ] Add RED Playwright assertions at `#deck` and `#cards`: initial 48, middle/end scroll `<=96`, first tile detached, focused selection connected, zero page/console errors.
- [ ] Run `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/cards-deck-wave1.spec.ts meta-app/tests/e2e/deck.spec.ts --workers=1`; expect initial count above 96.
- [ ] Window only `PoolPane`; leave the 40-card `DeckGrid` unchanged and preserve drag, detail, filter, and dirty-navigation contracts.
- [ ] Re-run Playwright plus `npx vitest run tests/meta/useWindowedCollection.test.tsx tests/meta/CardsScreen.test.tsx --maxWorkers=1`; expect PASS.
- [ ] Run `npm run typecheck`, changed-file ESLint, `git diff --check`, `npm run docs`, and `npm run docs:check`.
- [ ] Commit as `fix(meta): bound deck catalog rendering`.
