# CT-P10 Card Wave Implementation Plan

> **For agentic workers:** Execute tasks inline with TDD; one card cluster at a time.

**Goal:** Implement all 102 currently published CT-P10 card numbers (the original 82 plus 20 later-added numbers), their parallel printings, and any minimal engine extensions proven necessary by official Q&A.

**Architecture:** Treat `cards-data/ct-p10/*.tsv` as the local official-text source and the committed Q&A hash snapshot as provenance. Classify every unique printing before authoring. Existing DSL is used for green cards; a new engine primitive requires a separate T3 test-first mini-wave and can unblock only its dependent cards.

**Tech Stack:** TypeScript, Effect Descriptor DSL, Vitest, Playwright, official card API/Q&A hash tools.

## Global Constraints

- Official card text/Q&A is inspected locally first; raw official Q&A text and URLs are not committed.
- Every card has grounding, a focused behavior test, parallel parity, zero-candidate/optional coverage, and compiler validation.
- Cards with an unproven semantic mapping remain explicit DEFER entries; no inferred behavior.
- Landscape mobile evidence uses 851×393. Phase 4 starts only after this wave is integrated and pushed.

### Task 1: Inventory and adjudication map

**Files:** Create `docs/superpowers/plans/2026-07-26-ctp10-card-wave.md`; generate only `.tmp/ctp10/*`.

- [ ] Run `node scripts/cards/check-official-sync.cjs` and parse the four CT-P10 TSV files into 102 distinct IDs plus parallel groups.
- [ ] Run `npm.cmd run ground -- <IDs>` in 10-card chunks; inspect each local dossier and its FAQ JSON.
- [ ] Classify each ID as `existing-dsl`, `engine-gap`, or `defer`, recording card ID, Q&A hash, exact DSL analogue, and required test in `.tmp/ctp10/adjudication.json`.
- [ ] Run `node scripts/taskA-validate-specs.cjs` and fail the wave if any candidate cannot be grounded.

### Task 2: Existing-DSL card clusters

**Files:** Create `src/cards/ct-p10/<ID>.ts`, `tests/cards/ct-p10/<cluster>.test.ts`, `.claude/specs/grounding/<ID>.md`; modify `src/cards/_reuse/index.ts`.

- [ ] For one semantic cluster, write a failing real-engine test for the printed effect and a decoy/zero-or-decline case.
- [ ] Run that test and confirm RED because its CardDef is absent.
- [ ] Author only the matching DSL CardDefs, register them, and create parallel definitions with identical abilities.
- [ ] Run the focused test, `npm.cmd run ground -- <IDs>`, and `node scripts/taskA-validate-specs.cjs`; repeat until no `existing-dsl` CT-P10 card remains.

### Task 3: Engine-gap mini-waves

**Files:** Modify only the exact engine owner files discovered by Task 1; create `tests/engine/ctp10-<primitive>.test.ts` before source; then create dependent card/test/grounding files.

- [ ] Create a BUG record for every confirmed gap with official Q&A hash, reproduction, and horizontal consumers.
- [ ] Write a failing engine test covering owner/side, zero candidate, queue boundary, turn cleanup, and one decoy card.
- [ ] Implement the narrow additive primitive, run the engine test green, then add only cards blocked by it using Task 2's RED/GREEN cycle.
- [ ] Run a structural search for all matching card texts and add every safely equivalent CT-P10 consumer or retain it as explicit DEFER.

### Task 4: Q&A and cross-card closure

**Files:** Modify `.claude/specs/qa-adjudication/*.json`, grounding files, BUG records, `.claude/memory.md`, and changelog entry only after behavior is verified.

- [ ] For every CT-P10 FAQ row, record `manual-semantic` or strict `group-equivalent` with card ID, Q&A hash, implementation line, and assertion line.
- [ ] Run `npm.cmd run qa:adjudication:merge`, `npm.cmd run qa:adjudication:verify-local`, `npm.cmd run docs:qa-trace`, and `npm.cmd run lint:qa`.
- [ ] Verify `ct-p10` has no unimplemented IDs; every deliberately deferred item has a blocker and test evidence.

### Task 5: Ship gate and Phase 4 handoff

**Files:** Modify changelog/memory/BUG records only if gates pass.

- [ ] Run focused Vitest per cluster, full `npm test`, `typecheck`, `lint`, `lint:bugs`, `lint:listener`, `lint:side-channel`, `docs:check`, `smoke:1000`, and `benchmark`.
- [ ] Run targeted Playwright at desktop and 851×393 for each new picker/hidden-zone surface; require console errors 0.
- [ ] Commit coherent completed waves, push them, merge to `main`, then start Phase 4 YOU vs CPU manual test records with the CT-P10 deck coverage matrix.
