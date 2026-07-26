# Task 2 Report — Reorder UI

## Outcome

- Added `SelectableCardTile` and shared `CardExpandModal` detail flow to DeckReorder, DeckPlace, and Souza reorder rows.
- Stable occurrence IDs (`cardId#index`) survive reordering; confirm payloads stay original card-ID arrays.
- Covers arrow, drag, bucket, empty list, image fallback, detail-close order, and duplicate occurrences.
- Controls wrap with 44px targets; tiles and controls are sibling buttons.

## RED → GREEN

1. Added detail/duplicate/order tests for DeckReorder; RED had no tiles.
2. Added Souza detail/reorder/confirm and empty-list tests; RED had no tiles.
3. Added DeckPlace detail/bucket/duplicate tests; RED had no tiles.
4. Integrated shared tile/modal hooks and stable row models; all focused cases turned GREEN.

## Verification

- `npm test -- tests/ui/components/DeckReorderModalHost.reset.test.tsx tests/ui/components/DeckPlaceModalHost.test.tsx tests/ui/components/SouzaReorderModal.test.tsx` — 3 files, **12 tests**, pass.
- `npx playwright test tests/e2e/bug-136-deck-reorder.spec.ts tests/e2e/miniwave5-deck-place.spec.ts` — 6 pass.
- `npm run typecheck`, targeted ESLint, `npm run docs:check`, and `git diff --check` pass.

## Horizontal review

- Existing BUG-136 and mini-wave #5 E2E routes retain dispatch payload and drag/bucket behavior.
- Shared tile still covers unregistered-card image fallback in all three modal paths.
- Follow-up strengthened duplicate occurrence ordering, payloads, image-error fallback, and Souza drag/confirm/cancel. CSS raises Souza confirm/cancel to 44px.
