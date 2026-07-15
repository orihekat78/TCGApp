## User-reported bug wave (2026-07-14)

### Fixed

- BUG-189–193, 198: browse/pick modal ownership and priority, B04026's full
  reveal → choice → bottom-order → hand-to-scene chain, contact hand review,
  and CPU's important-move-only presentation delay.
- BUG-194, 197: partner effective AP now shares the engine/UI reader and
  original-ability disable now covers printed abilities while preserving
  granted and already-resolved effects.
- BUG-195–196: `eventRemoveByAP` no longer creates a duplicate pick; B04018
  and B04018P share all three printed abilities. The same duplicate-pick
  pattern was corrected in B05067 and B05069.

### Verification

- Focused engine, card, UI, and browser probes; typecheck; lint; bug lint;
  listener/side-channel/docs checks; full Vitest; smoke 1000; benchmark;
  adversarial and mechanical reviews are green.
- Full Playwright/complete-match execution is intentionally delegated to CI at
  the user's request. Cost-8 removal remains unregistered and deferred until
  its card ID and game log are available.
