# Phase 3: Card-choice visuals and landscape QA

**Goal:** Every choice shows safe card detail without changing resolution identity.

**Scope:** shared `SelectableCardTile`; reorder/place; pending decisions; real desktop/mobile flows; modal-stack remediation.

## State to UI

| State | UI | Identity |
|---|---|---|
| `pendingDeckReorder.cardIds` | Deck reorder | original card-ID order |
| `pendingDeckPlace.cardIds` | Deck place | original card-ID bucket |
| `pendingChooseIntercept` | intercept | chooser hand occurrence |
| `pendingSetCardReplacement` | replacement | candidate occurrence |
| `pendingChooseGuard` | guard | public character occurrence |
| evidence `faceUp` | browser/picker | public only when face-up |

## Work

1. Add a shared tile with artwork, public detail, stable DOM identity, and a separate detail control.
2. Replace text rows in reorder/place/Souza and pending decision hosts; preserve each engine callback payload.
3. Cover real flows: detail close, duplicate occurrence, hidden choice, loaded artwork, and console zero.
4. Audit modal priority, timed reveal pause, non-modal pointer pass-through, and formal mobile landscape containment.

## Edge cases

- Zero candidates render an empty state; no select or confirm callback fires.
- Negative index, count, or ordinal is rejected before UI state or engine payload changes.
- Hidden cards show a back and a safe ordinal; no card ID, URL, metadata, or instance ID leaks.
- Duplicate public cards receive display ordinals only; payloads retain their original occurrence identity.
- Confirm is irreversible: after dispatch it cannot be re-enabled or dispatch a second resolution.
- Detail close returns to the same pending decision; the next action resolves it exactly once, including chained continuation flows.
- Reveal timers pause while detail is open and resume only after close.
- Modal priority beats HUD/toast layout surfaces; actual HUD/toast controls stay interactive.
- Formal mobile is landscape Pixel 5, **851x393**. Portrait is out of scope.

## Gates

- Focused Vitest/RTL and targeted desktop/mobile Playwright.
- `npm run typecheck`, `npm run lint`, `npm run lint:bugs`, and `npm run docs:check`.
- Full test and smoke gates before Phase3 closure; record RCA, horizontal review, and commits in BUG tickets.
