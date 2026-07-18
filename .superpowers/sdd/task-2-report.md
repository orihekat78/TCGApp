# Task 2 Report — Reorder UI

## Outcome

- Added `SelectableCardTile` and the shared `CardExpandModal` flow to every row in DeckReorder, DeckPlace, and Souza reorder modals.
- Row occurrence IDs are stable (`cardId#index`) while reordered; confirm payloads remain the original card-ID arrays.
- Arrow, drag, deck-place bucket, empty-list, missing-image placeholder, detail-close order, and duplicate occurrence cases are covered.
- Row controls wrap and retain 44px minimum touch targets; tiles and controls are sibling buttons.

## RED → GREEN

1. Added DeckReorder detail/duplicate/order test; RED: no `[data-instance-id]` tiles (expected 3, got 0).
2. Added Souza interactive detail/reorder/confirm and empty-list tests; RED: no tiles (expected 3, got 0).
3. Added DeckPlace detail/bucket/duplicate test; RED: no tiles (expected 3, got 0).
4. Integrated existing shared tile/modal hooks and stable row models; all focused tests turned GREEN.

## Verification

- `npm test -- tests/ui/components/DeckReorderModalHost.reset.test.tsx tests/ui/components/DeckPlaceModalHost.test.tsx tests/ui/components/SouzaReorderModal.test.tsx` — 3 files, 7 pass.
- `npx playwright test tests/e2e/bug-136-deck-reorder.spec.ts tests/e2e/miniwave5-deck-place.spec.ts` — 6 pass (desktop/mobile; arrow, drag, bucket, engine payload).
- `npm run typecheck` — pass.
- Target TypeScript ESLint — pass.
- `npm run docs:check` — 0/112 generated files would change.
- `git diff --check` — pass.

## Horizontal Review / Concerns

- Reviewed existing BUG-136 and mini-wave #5 E2E paths; their dispatch payload and drag/bucket behavior remain green.
- No `SelectableCardTile` edits. Existing unregistered-card image behavior is exercised through the shared tile in all three modal paths.
- Pre-existing untracked `BUG-235.md` and card-choice plan remain untouched and must not be included in this commit.

## Review P2 Follow-up

- DeckReorder now asserts exact duplicate occurrence-ID order before/after move, after detail close, and mocked `deckReorderResolve` payload.
- DeckPlace now asserts detail-close bucket/order payload and drag-derived `deckPlaceResolve` payload.
- A registered visible card now dispatches an image `error` event in integration and must reach the shared SVG placeholder.
- Souza now exercises drag order plus confirm/cancel callbacks. Confirm and cancel controls have a CSS 44px touch-target contract.
- Sensitivity RED checks used temporary production mutations, then were reverted: duplicate occurrence ID, reorder payload, deck-place bucket payload, CardArt error fallback, and Souza `onDrop` all failed their strengthened tests as expected.
- The only persistent product gap was Souza confirm/cancel controls below the 44px minimum; CSS now sets `min-inline-size` and `min-block-size` to 44px.
