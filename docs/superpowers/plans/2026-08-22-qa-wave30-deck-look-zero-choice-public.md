# QA Wave 30 Deck-Look Zero-Choice Public Plan

**Goal:** Close seventeen official Q&A test gaps for declining an eligible deck-look match.

**Architecture:** Start every real card through its public trigger, reach `deckRevealUntil`, decline an existing eligible candidate through `effectPickResolve`, and prove mandatory remainder movement plus complete lifecycle cleanup. Hash-only Q&A identity protects official text. Production behavior changes only after a focused RED witness.

**Rules:** `.claude/rules/15-abilities-effects.md`, `21-declared-ability-cost.md`, `25-qa-effects-resolution.md`, `26-qa-deck-refresh.md`.

## Cohort

- Enter or enter-derived: `B04048`, `B07010`, `B07015`, `PR098`, `PR104`, `PR180`, `PR186`.
- Declared: `B06013`, `B06098`, `B08024`, `B08071`, `B08094`, `B09112`, `B10082`.
- Leave or phase end: `B09073`, `B10068`.
- Granted assault leave: `B10101`.
- Shared ruling: “up to one” permits zero even when an eligible card exists.

## Task 1: Freeze and Ground

- [x] Select sixteen current `test-missing` rows sharing the same rule family.
- [x] Add the structurally related B10101 row after hidden-information review exposed the same gap.
- [x] Confirm all seventeen use `deckRevealUntil` with `chooseMatch: 'upTo'`.
- [x] Exclude ambiguous or different primitives (`B08075`, `B09078`, `B10097`).

## Task 2: Public Runtime Witnesses

- [x] Add seventeen card-bound witnesses from each real public trigger.
- [x] Surface one eligible candidate with `[nMin, nMax] = [0, 1]`.
- [x] Decline with `pickedUid: null`; prove no hand add and correct remainder movement.
- [x] Prove costs, prior steps, optional gates, and pending/overlay/runtime cleanup.

## Task 3: Exact QA Evidence

- [x] Attach seventeen exact card-specific Q&A IDs without official text or URLs.
- [x] Move every shard row from `test-gap` to `aligned` with exact evidence lines.
- [x] Regenerate QA trace and baseline; confirm `matched +17`, `test-missing -17`.

## Task 4: Verification and Commit

- [x] Repair the adversarial B10068/B10101 hidden-information finding with RED-backed selected-only publication tests.
- [x] Pass focused and structurally similar tests, typecheck, lint, build, and smoke.
- [x] Pass adjudication merge, local verification, Q&A lint, and generated-doc checks.
- [x] Obtain rules adjudication and test review with no unresolved BLOCK.
- [x] Pass full Vitest, inspect staging, commit Wave 30, and prove a clean tracked tree.

## Acceptance

- All seventeen selected rows become `matched` with card-bound public-runtime evidence.
- Decline preserves no selected card in hand and completes each card’s mandatory tail.
- Any production fix is narrow, RED-backed, and horizontally investigated.
- B10068/B10101 keep looked cards private; only a selected card becomes public.
