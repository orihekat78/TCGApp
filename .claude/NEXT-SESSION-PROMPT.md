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

1. Follow `.claude/specs/remaining-27-engine-portfolio.md` as the frozen execution plan.
2. Repair stale context/shipped inventory, then batch-ground all remaining IDs once.
3. Probe the six existing-DSL candidates before adding any primitive.
4. Execute additive, data/bind, UI-serial, then structural-serial engine waves.
5. After engine checkpoint and CI, add remaining cards/P variants in three parallel lanes.

## Rules

- Run `npm run ground -- <IDs>` before authoring; no partial cards.
- Check 0 choice, owner=opp, AI/human parity, stale state, duplicate IDs, and base/P equality.
- New decision UI requires Playwright.
- Broad gates run only at engine integration and final `2074/2074`.
- CI checkpoints are engine integration and final `2074/2074`.
