# QA Wave 28 Effect-Entry Trigger Public Plan

**Goal:** Close eight official Q&A test gaps for characters entered by triggered card effects.

**Architecture:** Play each real source through `dispatchEngineAction`, resolve its surfaced `sceneEnter` decision, and prove a typed synthetic target's real `enter` hook resolves after entry. Hash-only QA identity protects official Q&A text. Production behavior changes only after a focused RED probe.

**Rules:** `.claude/rules/03-field-areas.md`, `15-abilities-effects.md`, `17-icons.md`, `19-special-rules.md`, `20-color-and-switch.md`, `25-qa-effects-resolution.md`.

## Cohort

- Hand entry: `B03068`, `B04046`, `B06074`, `PR155`, `PR161`.
- Remove-area entry: `B07082`, `B08091`, `B09075`.
- Shared ruling: a character entered by a triggered effect emits its normal entry hook.

## Task 1: Freeze and Ground

- [x] Select eight current `test-missing` rows sharing question hash `2aa7…`.
- [x] Ground exact source ability, condition, source zone, state, and filter.
- [x] Confirm existing tests do not already own these eight QA IDs.

## Task 2: Public Runtime Witnesses

- [x] Add eight card-bound positive witnesses through public dispatch and decision adapters.
- [x] Exclude wrong kind, level, name, trait, color, or keyword candidates.
- [x] Assert source and target entry, target trigger resolution, log order, zone splice, and cleanup.
- [x] Prove explicit decline and both zero-candidate public contracts.

## Task 3: Exact QA Evidence

- [x] Attach the eight card-specific QA IDs without official text or URLs.
- [x] Move each shard row from `test-gap` to `aligned` with exact source and assertion lines.
- [x] Regenerate QA trace and baseline; confirm `matched +8`, `test-missing -8`.

## Task 4: Verification and Commit

- [x] Pass focused and structurally similar tests, typecheck, lint, build, and smoke.
- [x] Pass adjudication merge, local verification, QA lint, and generated-doc checks.
- [x] Obtain rules adjudication and test review with no unresolved BLOCK.
- [x] Pass full Vitest without reducing the baseline count.
- [x] Review explicit staging, commit Wave 28, and prove a clean tracked tree.

## Acceptance

- All eight selected rows become `matched` with card-bound public-runtime evidence.
- Each target's `enter` effect resolves after `sceneEnter`; every public authority clears.
- Any production fix is narrow, RED-backed, and horizontally investigated.
