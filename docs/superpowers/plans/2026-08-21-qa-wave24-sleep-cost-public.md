# QA Wave 24 Sleep-Cost Public Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task.

**Goal:** Certify 24 test-missing official Q&A records across 11 base cards through exact public-dispatch witnesses for selected sleep costs and their related continuations.

**Architecture:** Production card definitions remain unchanged unless a RED proves a real defect. Tests create real card states, provide explicit cost `uid`s through `declaredAbility`, resolve every public pending decision with bound authority, and assert final semantic state. Entry-trigger cases use `handUseCard`, never direct resolver calls. Controller-relative deck costs share one side resolver in can-pay, dry-run, and live payment.

**Tech Stack:** TypeScript, Vitest, public engine dispatcher, generated QA trace.

**Rules:** `.claude/rules/03-field-areas.md`, `15-abilities-effects.md`, `16-card-set.md`, `21-declared-ability-cost.md`, `25-qa-effects-resolution.md`.

## Constraints

- Prove ownership, active-state, filter, and `excludeSelf` rules with explicit selected UIDs.
- Rejected costs must leave the complete semantic state unchanged.
- Prove compound costs atomically; no partial sleep when a later item is unavailable.
- Resolve optional, discard, remove, and scene-entry continuations through public authority.
- Use real base cards and verify alternate printings preserve base abilities.
- Add only current manifest QA IDs; never infer or invent official semantics.
- Do not hand-edit `.claude/auto/**`; regenerate through repository scripts.

## Cohort

- Sleep-cost authority: `B01063`, `B03060`, `B04070`, `B06066`, `B06078`, `B07002`, `B07016`, `B07067`, `B09058`, `B09082`, `D01003`.
- Entry and continuation: `B07002`, `B07016`, `B07067`, `B09058`.
- Printings: base plus `P` for `B03060/B04070/B06066/B06078/B07002/B09058`; base plus `P/P2` for `B07016`.

## Task 1: Freeze RED Baseline

- [x] Assert all 24 selected IDs are currently `test-missing` and adjudicated `test-gap`.
- [x] Record the exact selected ID set and expected coverage delta.

## Task 2: Public Sleep-Cost Authority

- [x] Add `tests/cards/official-qa/declared-sleep-cost-public-wave24.test.ts`.
- [x] Prove explicit second-payer selection and that only the selected own active card sleeps.
- [x] Reject opponent, forged, excluded-self, sleeping, stunned, and filter-decoy UIDs without mutation.
- [x] Cover trait, card name, level, color, self-allowed, and exclude-self filter families.
- [x] Prove compound-cost atomicity and the B04070 stun-to-sleep activation rule.
- [x] Prove B06078 exact three-card payment, self eligibility, own-deck ownership, and conditional tail.
- [x] Prove B07002 turn bans persist after the source leaves.

## Task 3: Public Entry and Continuation Semantics

- [x] Add `tests/cards/official-qa/sleep-cost-related-entry-public-wave24.test.ts`.
- [x] Prove B07002 short-deck refresh, two-card draw completion, then two-card removal.
- [x] Prove B07016 choosing zero consumes its turn-one trigger.
- [x] Prove B07067 equality and post-hand-use hand-count evaluation.
- [x] Prove B09058 paid hand card may re-enter, fires enter ability, and full-scene switch may remove the new source.

## Task 4: Refresh Evidence

- [x] Update only selected adjudication shard items with exact source and assertion-test evidence.
- [x] Regenerate QA trace and confirm `matched +24`, `test-missing -24`.
- [x] Run `npm run docs:check`, `npm run lint:qa`, and `npm run qa:adjudication:verify-local`.
- [x] Record Wave 24 findings in `.claude/memory.md`.

## Task 5: T3 Verification and Commit

- [x] Run focused tests, typecheck, lint, build, smoke, and relevant isolated Playwright.
- [x] Obtain Sol semantic/adversarial and Terra test review; resolve every BLOCK.
- [x] Investigate structurally similar sleep-cost and entry consumers.
- [x] Run full Vitest, `git diff --check`, complete diff review, and clean release-preparation test.
- [x] Commit one coherent Wave 24 candidate and re-prove the clean worktree.

## Acceptance

- All 24 IDs have exact public assertions and aligned adjudication evidence.
- Invalid costs are atomic; valid explicit choices affect only the selected own card.
- Related continuations settle with no pending authority or runtime residue.
- Full static, QA, runtime, UI, review, and cleanliness gates pass.
