# Next Session: Remaining 27 Engine Portfolio

## State

- branch: `main`; this session commits and pushes its completed primitive wave.
- Registry: **2047 / 2074; 27 remain**.
- Added: D10026, PR200, PR206, B09036/P, B09067/P.
- New primitives: scene face-down set-card count; effective same-name count;
  scene-to-deck-bottom effect; hand-reveal cardName bind; safe binding-conditional continuation.
- Final local evidence: Vitest 690 passed / 1 skipped; 5645 passed / 7 skipped;
  typecheck, docs structure, diff, registry validation, and smoke1000 green.

## Next Work

1. Read current context and compute remaining IDs from TSV minus `ALL_CARDS`.
2. Plan **engine-first**: group all 27 cards by shared missing primitive.
3. Implement primitives in isolated T3 lanes, each with a representative card and RED probe.
4. After primitive integration and Sol/full gates, add unlocked cards/P variants in three parallel card lanes.

## Rules

- Run `npm run ground -- <IDs>` before authoring; no partial cards.
- Check 0 choice, owner=opp, AI/human parity, stale state, duplicate IDs, and base/P equality.
- New decision UI requires Playwright.
- Do not run second CI until all cards are added and registry is 2074/2074.
