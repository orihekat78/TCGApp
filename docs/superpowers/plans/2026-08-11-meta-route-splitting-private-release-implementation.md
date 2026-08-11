# Meta Route Splitting and Private Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep HOME light while preserving fail-closed private staging and NEWS communication.

**Architecture:** HOME stays eager; other screens and engine registration become dynamic route dependencies. A generated partner/case identity index removes HOME/store imports of the full engine card graph, while release auditors validate every manifest-reachable chunk.

**Tech Stack:** React.lazy, Vite/Rollup manifest, TypeScript AST release audit, Vitest, Playwright.

## Global Constraints

- Keep official NEWS GET and existing CSP destination; add no other network origin.
- Stage only the exact Vite manifest closure; reject extra entries/chunks/images.
- No dependency install, public hosting, `dist-meta`, or runtime card-data fetch.

---

### Task 1: Detach HOME from the full card graph

**Files:**
- Create: `scripts/gen-meta-card-identities.ts`
- Create: `meta-app/src/data/cardIdentities.generated.ts`
- Create: `tests/meta/cardIdentities.generated.test.ts`
- Modify: `meta-app/src/screens/HomeScreen.tsx`, `HomeDeckSelectorDialog.tsx`
- Modify: `meta-app/src/state/decksStore.ts`, `meta-app/src/data/sampleDeck.ts`
- Modify: `package.json`

- [ ] Write RED tests that importing HOME/decksStore never loads `cardPool`/`@/cards`, generated partner/case names cover all identities, and generated output is deterministic.
- [ ] Run `npx vitest run tests/meta/cardIdentities.generated.test.ts tests/meta/decksStore.test.ts --maxWorkers=1`; expect missing generator/index and forbidden import failures.
- [ ] Generate a committed identity map for partner/case display, default-case lookup, and legacy non-deck filtering; move unused `deckStats` away from eager sample data.
- [ ] Add generation check to qualification inputs; run generator twice and require zero diff.
- [ ] Re-run focused tests and commit as `perf(meta): detach home from card registry`.

### Task 2: Lazy route and game runtime ownership

**Files:**
- Create: `meta-app/src/router/lazyScreens.tsx`
- Create: `meta-app/src/services/gameRuntime.ts`
- Modify: `meta-app/src/App.tsx`, `meta-app/src/main.tsx`
- Create: `tests/meta/lazyRoutes.test.tsx`

- [ ] Write RED tests proving HOME is eager, each route imports only on navigation, retry recovers one failed import, and `ensureGameRuntimeReady()` calls `registerAll()` once across concurrent callers.
- [ ] Run focused tests; expect static imports and eager registration.
- [ ] Replace non-HOME screen imports with `React.lazy`; wrap loading/error state; call runtime readiness before SETUP/MATCH/REPLAY/TUTORIAL ownership begins.
- [ ] Re-run route/session tests; prove retry never duplicates MatchSession.
- [ ] Commit as `perf(meta): load routes and game runtime on demand`.

Runtime owner shape:

```ts
let runtime: Promise<void> | undefined;
export const ensureGameRuntimeReady = () => runtime ??=
  import('@/cards/index').then(({ registerAll }) => { registerAll(); });
```

### Task 3: Fail-closed dynamic chunk release contract

**Files:**
- Modify: `scripts/private-hosted/audit-runtime-boundary.ts:12813-13053`
- Modify: `scripts/private-hosted/manifest.ts:263-309`
- Modify: `tests/release/private-hosted-runtime-boundary.test.ts:4438-4464`
- Modify: `tests/release/private-hosted-manifest.test.ts`
- Modify: `tests/e2e/private-hosted-static.spec.ts`
- Modify: release design/operations docs and trusted bundle hashes.

- [ ] Replace the old RED that rejects every `dynamicImports` entry with REDs accepting only reachable, declared, integrity-pinned chunks and rejecting unknown keys, unsafe edges, orphan files, extra entries, and forbidden markers in any chunk.
- [ ] Run `npx vitest run tests/release/private-hosted-runtime-boundary.test.ts tests/release/private-hosted-manifest.test.ts --maxWorkers=1`; expect current `dynamic-import` rejection.
- [ ] Traverse manifest imports/dynamicImports, bind logical keys to reviewed SHA-256 values, scan every JS/CSS asset, and keep single HTML entry plus no-orphan closure.
- [ ] Build private output; update hashes only after source diff review; re-run advanced boundary and release tests.
- [ ] Add production browser assertions: HOME has no catalog/game chunks, DECK loads catalog once, SETUP/MATCH loads game once, NEWS still performs one approved GET.
- [ ] Run `npm run test:e2e:private-hosted`, `npm run typecheck`, `npm run lint`, docs gates, and `git diff --check`.
- [ ] Commit as `perf(release): qualify lazy Meta route chunks`.

### Task 4: Integration and publication gate

- [ ] Run full Vitest, full Meta/root Playwright relevant projects, 1,000-run smoke, and `npm run private-hosted:qualify-final` from a clean commit.
- [ ] Request UI/UX, release-security, regression, and visual adversarial review; fix only reproduced blockers with new REDs, then re-review.
- [ ] Deploy the qualification report's exact staging directory; do not rebuild.
- [ ] Verify anonymous Access redirects and authenticated PC/smartphone HOME→DECK scroll→CARDS→SETUP→MATCH, portrait/landscape round trips, NEWS, and console/network cleanliness.
- [ ] Record commit, deployment ID/URL, report hashes, and horizontal findings; push and prove local/remote equality.
