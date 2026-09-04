# QA Wave 29 Action-Entry Public Plan

**Goal:** Close eight official Q&A test gaps for characters entered by action-triggered effects.

**Architecture:** Declare each real source through `dispatchEngineAction`, advance the public action state machine to the exact trigger point, resolve every surfaced decision, and prove a typed synthetic target's real `enter` hook. Hash-only QA identity protects official Q&A text. Production behavior changes only after a focused RED witness.

**Rules:** `.claude/rules/03-field-areas.md`, `07-action-flow.md`, `15-abilities-effects.md`, `17-icons.md`, `20-color-and-switch.md`, `22-qa-action-contact.md`, `25-qa-effects-resolution.md`.

## Cohort

- Action declare: `B04068`, `B05048`.
- Action end: `B03073`, `B04030`, `B05108`, `B06077`, `PR086`, `PR092`.
- Shared ruling: a character entered by an action-triggered effect emits its normal entry hook.

## Task 1: Freeze and Ground

- [x] Select eight current `test-missing` rows sharing question hash `2aa7…`.
- [x] Ground exact trigger, condition, origin, entry state, and candidate filter.
- [x] Confirm existing tests do not already own these eight QA IDs.

## Task 2: Public Runtime Witnesses

- [x] Add eight card-bound positive witnesses through public action and decision adapters.
- [x] Exclude wrong kind, level, name, trait, or color candidates.
- [x] Assert source cost, target entry, target trigger resolution, log order, zone splice, and cleanup.
- [x] Prove every optional decline, zero picks including turn1 consumption, alternate hand choice, source-left guards, and full-scene actor switch abort.

## Task 3: Exact QA Evidence

- [x] Attach the eight card-specific QA IDs without official text or URLs.
- [x] Move each shard row from `test-gap` to `aligned` with exact source and assertion lines.
- [x] Regenerate QA trace and baseline; confirm `matched +8`, `test-missing -8`.

## Task 4: Verification and Commit

- [x] Pass focused and structurally similar tests, typecheck, lint, build, and smoke.
- [x] Pass adjudication merge, local verification, QA lint, and generated-doc checks.
- [x] Obtain rules adjudication and test review with no unresolved BLOCK.
- [x] Pass full Vitest without reducing the baseline count.
- [x] Review explicit staging, commit Wave 29, and prove a clean tracked tree.

## Acceptance

- All eight selected rows become `matched` with card-bound public-runtime evidence.
- Entry hooks resolve once after `sceneEnter`; action and decision authorities fully settle.
- Any production fix is narrow, RED-backed, and horizontally investigated.
