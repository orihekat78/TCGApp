# QA Wave 27 Effect-Entry Public Verification Plan

**Goal:** Close eight official Q&A test gaps for characters entered by declared card effects.

**Architecture:** Each witness starts from a real shipped card, uses `dispatchEngineAction`, resolves the surfaced `sceneEnter` decision, and proves the entered fixture's `enter` trigger settles through the public runtime. RED event-decoy probes may justify only narrow card-descriptor fixes; engine behavior stays unchanged. Hash-only QA identity protects official Q&A text.

**Rules:** `.claude/rules/15-abilities-effects.md`, `17-icons.md`, `21-declared-ability-cost.md`, `25-qa-effects-resolution.md`.

## Cohort

- Hand entry: `B05055`, `B05112`, `B08009`, `B08056`, `B09044`.
- Remove-area entry: `B04018`, `B05052`, `B07069`.
- Shared ruling: an effect-driven scene entry emits the normal entry hook.

## Task 1: Freeze and Ground

- [x] Select only current `test-missing` records in one question-hash family.
- [x] Ground each card against pinned official TSV data without copying Q&A bodies.
- [x] Verify real costs, filters, source zones, and declared ability IDs.

## Task 2: Public Runtime Witnesses

- [x] Add one eight-case official-QA test file using real card definitions.
- [x] Dispatch every declaration and decision through the public UI adapter.
- [x] Include invalid-type, level, color, trait, keyword, or name decoys, including a same-name event.
- [x] Assert paid costs, target entry, triggered draw, decision cleanup, and runtime cleanup.
- [x] Resolve `B04018`'s same-owner simultaneous triggers through public owner ordering.
- [x] Prove explicit decline and zero-candidate auto-skip settle without entry.

## Task 3: Exact QA Evidence

- [x] Attach the eight current card-specific QA IDs.
- [x] Move each shard from `test-gap` to `aligned` with a card-bound assertion line.
- [x] Regenerate QA trace and baseline; confirm `matched +8`, `test-missing -8`.

## Task 4: Verification and Commit

- [x] Pass focused tests, typecheck, lint, build, smoke, and regression Playwright.
- [x] Pass adjudication merge, local raw verification, QA lint, and generated-doc checks.
- [x] Obtain Sol rules adjudication and Terra test review with no unresolved BLOCK.
- [x] Investigate structurally similar effect-entry and owner-order paths.
- [x] Pass full Vitest without reducing the baseline count.
- [x] Review the complete staged diff, commit Wave 27, and prove a clean tracked tree.

## Acceptance

- All eight selected records are `matched` with exact source and assertion evidence.
- Every entered card's trigger occurs after `sceneEnter` and all public authority clears.
- Production engine remains unchanged; `B08056` and `B09055/P/P2` explicitly filter characters after RED event-decoy probes.
