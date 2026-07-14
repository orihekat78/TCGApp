# Remaining 27 Engine-First Portfolio

## Decision

- Registry source of truth: TSV minus live `ALL_CARDS`; current `2047/2074`, remaining 27.
- Implement all required engine primitives before bulk card authoring.
- Every primitive includes one representative card and RED probe as acceptance evidence.
- After engine integration, add all remaining base/P variants in three parallel card lanes.
- Optimize for two broad checkpoints: engine integration and final `2074/2074`.

## Phase 0: Repair Sources And Reclassify

1. `git status --short`; `git log -1 --oneline`; `npm run docs:codex-context`.
2. Refresh shipped dump with `npx tsx scripts/compiler/dump-shipped.ts`.
3. Do not use stale `.tmp/_registered-ids.json` or `inventory-remaining.cjs` until repaired.
4. Run one batch `npm run ground -- <all remaining IDs>`; agents must not repeat grounding.
5. Probe before adding primitives: D06013, B06027, B07013, B09047, B09052/P.

## Primitive Waves

| Wave | Parallel lanes / serial order | Unlock |
|---|---|---|
| 1 additive | remove filter count; opponent level aura; hand-level aura | B05062+B08078/P; B04046/P; B06047 |
| 2 data/bind | discard-down+level sum; turn use/enter ban; deck category quotas | B07076/P; B06103/P; B09078 |
| 3 UI serial | leave intercept -> opponent optional -> trait declare -> RPS | B01092/P; B02086/P; B08074; B07011 |
| 4 structural serial | set occurrence picker -> set removal replacement -> alternative cost | B02039; B02052/P; B05033 |

UI decision flows share pending/dispatch/modal state and must have one writer. Set-card picker and replacement share occurrence/mutation state and remain serial.

## Lane Contract

- Main freezes type/payload, representative card, owned files, RED cases, and UI/AI consumers first.
- Maximum concurrency: main plus three subagents. Use isolated worktrees for writers.
- Terra implements; Luna collects/counts; Sol reviews contracts and integrated T3 waves only.
- Lane commands: focused Vitest, `npx tsc --noEmit`, `git diff --check`.
- No lane-level full Vitest, smoke, docs, CI, or per-card Sol review.
- Report only: `STATUS`, changed files, RED, GREEN, remaining risk.

## Required Semantics

- Check zero/decline, owner=opp, AI/human parity, stale pending state, duplicate IDs, source/target leave, and base/P equality.
- New UI type requires one Playwright spec per UI type, not per card.
- Do not combine leave intercept, generic opponent decisions, RPS, or set-card replacement into one generic state machine.
- Do not ship partial cards. P/P2 stays with its base lane and uses an independent definition.

## Engine Checkpoint

Root runs once: typecheck, full Vitest, smoke1000/baseline, required Playwright, docs, diff check, Sol review, commit/push, CI. Do not poll CI in the active turn.

## Card Phase And Completion

1. Recompute remaining IDs and ground all unlocked IDs once.
2. Split semantic families across three card lanes; engine/registry/docs edits are prohibited in lanes.
3. Root integrates registry, DEFERRED, memory, and recount once.
4. Require `2074 total / 2074 unique / validation 0`.
5. Run final typecheck, full Vitest, smoke/baseline, docs, diff, commit/push, and final CI.

## Token Controls

- Give agents only dossier, frozen contract, owned files, one exemplar, and focused probe.
- Use `fork_turns="none"` with a complete bounded prompt where possible.
- Never return full logs or full diffs; return counts and exact failures only.
- Run broad suites only at the two checkpoints.
- End a session after two primitive batches or around 60% context; persist state here and in a commit.
