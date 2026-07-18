# Task 4 report

Status: COMPLETE — mounted desktop/mobile proof passes after the responsive EffectPicker fix.

## Owned E2E coverage

- B06029 real `handUseCard`: mixed face-up/face-down evidence, public CDN art, public detail click and right-click, normal close button, hidden back with no art/ID/detail, native evidence-primary Enter, hand-to-evidence actual-card/detail chooser, final hand/evidence/scene state, console/page errors 0.
- B04026 distinct reveal/reorder: all three public images including noneligible cards, eligible yellow primary, detail click and right-click with normal close, explicit decline, reorder detail click/right-click, native confirm Enter, exact reordered deck state, subsequent hand-choice completion, console/page errors 0.
- B04026 duplicate reveal/reorder: independently addressable `B04021#1` / `B04021#2` primaries and details, distinct reorder occurrence IDs before/after movement, duplicate-preserving engine state, subsequent flow completion, console/page errors 0.

## RED history

Before CardList wiring, B06029 failed because `card-list-pick-detail-evidence:self:0` was absent. B04026 failed because the reveal list had no shared visual tile/detail path. The fixture's first `{ ok:false }` was traced to the case-color gate and corrected.

The image-helper review added a load-completion gate (`complete && naturalWidth > 0`)
and exact final `currentSrc` checks for every public B06029/B04026 reveal, picker,
and reorder image. A temporary
B06029 mutation from D08003's `1743743093434380.jpg` to D08011's valid official
`1743743093474254.jpg` failed with the exact expected/received URL mismatch. The
mutation was reverted before the green run.

## Mounted browser results

Server: `npx vite --host 127.0.0.1 --port 5198 --strictPort`.

```text
Chromium:        B06029 + B04026 distinct + B04026 duplicate = 3/3 PASS
Mobile Chromium: B06029 + B04026 distinct + B04026 duplicate = 3/3 PASS
Total: 6/6 PASS
```

The mobile sensitivity run before production commit `6f9be7f8` failed after
`scrollIntoViewIfNeeded()`:

```text
effect-pick-detail-D08011#0 right edge = 406.5px
mobile viewport width = 393px
overflow = 13.5px
```

Root cause was the fixed 420px minimum without a mobile override. Commit `6f9be7f8`
made the modal responsive; the same assertion now passes on the 393px viewport.
No production file was edited by Task4. Normal close-button interaction passes in
every exercised detail modal; no `force`, Escape, or backdrop close is used.

Target ESLint and `git diff --check` pass. Self-review found no screenshot-only,
force-click, hidden-identity, or unresolved-flow assertions. Horizontal coverage
includes the generic EffectPicker actual-card chooser and DeckReorder duplicate
occurrence identity.
