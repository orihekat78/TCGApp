# Task 2 implementer report

## RED

`npx vitest run tests/meta/CardsScreen.test.tsx --maxWorkers=1` failed as
expected before integration: `expected ... to have a length of 48 but got 1245`
at the initial mounted-card assertion. The initial RED run had 2 failed / 11
passed tests; the second new assertion also exposed the pre-existing unwindowed
view toggle shape.

## Change

- CARDS grid and list use `useWindowedCollection` with full-result count intact.
- Inert full-width spacers preserve the scroll range; stable item registrations
  avoid ref churn during range and view updates.
- Tests cover initial 48, distant unmount, 96 ceiling, filter/view change, and
  selected-print retention.

## Verification

- PASS `npx vitest run tests/meta/CardsScreen.test.tsx tests/meta/useWindowedCollection.test.tsx --maxWorkers=1` — 2 files, 24 tests.
- PASS `npm run typecheck`.
- PASS `npx eslint meta-app/src/screens/CardsScreen.tsx tests/meta/CardsScreen.test.tsx`; CSS is ignored by the ESLint configuration.
- PASS `git diff --check`.

Self-review: complete. Horizontal investigation: grid and list both use the
same window, keep `filtered.length` status, and preserve existing selection
and keyboard handler contracts.

## Fix round 1

RED: the scoped review tests failed with grid spacers inside `.cards-card-grid`
instead of gapless scroll siblings, and a distant focused card unmounted.
The stricter filter-reset probe then failed `expected 48 but got 96`; an
unchanged inspector selection was pinning the old distant range.

Change: grid/list gaps now live only on their visible-item wrappers. CARDS
passes folded selected and captured focus keys to the hook, restores focus to a
materialized tile, and suppresses only an unchanged selected key across a new
layout key so reset reaches the first 48. A later selected/focused key pins.

Verification: PASS `npx vitest run tests/meta/CardsScreen.test.tsx
tests/meta/useWindowedCollection.test.tsx --maxWorkers=1` (33 tests); PASS
`npm run typecheck`; PASS scoped ESLint and `git diff --check`.
