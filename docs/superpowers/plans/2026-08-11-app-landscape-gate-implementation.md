# App Landscape Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every Meta route in portrait and request landscape mode where supported.

**Architecture:** A browser-API hook owns orientation/fullscreen status. A top-level gate defers the first portrait mount, then preserves mounted route state behind an inert overlay during later portrait periods.

**Tech Stack:** React 19, Screen Orientation API, Fullscreen API, CSS, Vitest, Playwright.

## Global Constraints

- Cover all ten routes; never dispatch engine actions or cancel decisions.
- Orientation lock is progressive enhancement, never a guaranteed claim.
- Preserve focus, safe areas, reduced motion, route hash, and local draft state.

---

### Task 1: Browser landscape service

**Files:**
- Create: `meta-app/src/hooks/useLandscapeExperience.ts`
- Create: `tests/meta/useLandscapeExperience.test.tsx`

**Interfaces:**
- Produces: status `'pending' | 'portrait' | 'landscape'`, `requestLandscape()`, and last request result `'entered' | 'rotate' | 'denied'`.

- [ ] Write RED tests for initial pending, `matchMedia`/resize/orientation changes, fullscreen success/rejection, lock success/rejection, unsupported APIs, and listener cleanup.
- [ ] Run `npx vitest run tests/meta/useLandscapeExperience.test.tsx --maxWorkers=1`; expect missing-module failure.
- [ ] Implement passive status detection and a gesture-only `requestLandscape()` that requests fullscreen before `orientation.lock('landscape')`.
- [ ] Re-run; expect PASS and no unhandled rejected promise.
- [ ] Commit as `feat(meta): add landscape browser service`.

```ts
interface LandscapeExperience {
  status: 'pending' | 'portrait' | 'landscape';
  requestResult: 'idle' | 'entered' | 'rotate' | 'denied';
  requestLandscape(): Promise<void>;
}
```

Primary RED assertion:

```tsx
render(<LandscapeGate><StateProbe /></LandscapeGate>);
expect(screen.getByRole('button', { name: /横画面/ })).toHaveFocus();
setOrientation('landscape');
expect(screen.getByTestId('state-probe')).toHaveTextContent('unchanged');
```

### Task 2: Accessible whole-app gate

**Files:**
- Create: `meta-app/src/shared/LandscapeGate.tsx`
- Modify: `meta-app/src/App.tsx:47-124`
- Modify: `meta-app/src/styles/meta.css`
- Create: `tests/meta/LandscapeGate.test.tsx`

- [ ] Write RED component tests: first portrait defers children, landscape mounts once, later portrait keeps child mounted/inert, CTA focus, prior focus restoration, disconnected fallback, and Japanese recovery copy.
- [ ] Run `npx vitest run tests/meta/LandscapeGate.test.tsx --maxWorkers=1`; expect missing component.
- [ ] Implement the fixed dialog-like gate above `MetaShell`/`HelpOverlay`; preserve the route subtree after first landscape and use `inert` plus `aria-hidden` in portrait.
- [ ] Add safe-area/reduced-motion styles without changing screen-specific landscape CSS.
- [ ] Re-run hook/gate tests and existing navigation/focus suites; expect PASS.
- [ ] Commit as `feat(meta): require landscape across app routes`.

### Task 3: Public-flow rotation regressions

**Files:**
- Create: `meta-app/tests/e2e/landscape-gate.spec.ts`
- Modify: `meta-app/tests/e2e/visual-gates.spec.ts`

- [ ] Add RED public-flow tests: `393x851` gate before HOME, CTA rejected fallback, rotate to `851x393`, HOME→SETUP→MATCH, portrait/landscape round trip preserving mulligan or pending choice, keyboard focus, zero console errors.
- [ ] Run `npx playwright test --config meta-app/playwright.config.ts meta-app/tests/e2e/landscape-gate.spec.ts --workers=1`; expect gate selector missing.
- [ ] Add only testability attributes needed by real UI; do not inject GameState or navigate directly to MATCH.
- [ ] Re-run E2E on desktop and exact `851x393`; expect PASS.
- [ ] Run `npm run typecheck`, changed-file ESLint, `git diff --check`, and focused Meta tests.
- [ ] Commit as `test(meta): verify whole-app landscape recovery`.
