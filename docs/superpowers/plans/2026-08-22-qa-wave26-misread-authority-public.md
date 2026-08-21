# QA Wave 26 — Misread authority / public runtime

## Scope

- Risk: T3. Track A1 structural engine change.
- Stable official QA: 34 logical cases / 37 physical definitions.
- Two fixed hash groups: multi-Misread 20, printed-X 14.
- Existing unrelated `pnpm-workspace.yaml` remains untouched.
- Separate defect: B09016 `場合` resolution-time condition. Record, do not fold into this wave.

## Required behavior

1. A human Misread pause has one GameState authority plus one process-local live lease.
2. Persisted fields must match that exact lease; JSON/replay/cross-session restore fails closed.
3. Public resolve consumes both once and rejects forged, cloned, stale, or replayed state.
4. All selected cards sleep and total LP reduction commits before any `misread:performed` event.
5. One event is emitted per selected physical UID after commit.
6. Evidence and `reasoning:end` resume once, only for the authenticated reasoning action.
7. CPU resolution remains synchronous and leaves no pending authority.

## Test-first sequence

1. RED: persisted `__pendingMisread` without GameState authority is rejected transactionally.
2. RED: authority without side-channel; token/owner/reasoner/candidate/order/X forgeries reject.
3. RED: public stale action replay cannot sleep cards, gain evidence, or emit `reasoning:end` twice.
4. RED: first Misread observer sees every selected UID asleep and full LP reduction applied.
5. RED: real B05015 observes two selected Misread cards exactly twice after atomic commit.
6. GREEN: add state authority, schema/runtime equality checks, single atomic public resolver.
7. GREEN: refactor CPU apply order to the same validate → commit → emit boundary.
8. Add 34 exact QA annotations and runtime matrix, including three parallel print definitions.
9. Add UI multi-checkbox, JSON-clone/cross-session, non-finite collision,
   non-enumerable descriptor, and shared-alias topology rejection coverage.

## Implementation boundary

- `GameState.pendingMisreadAuthority` owns token, decision owner, reasoner, candidates, trace.
- Transfer the authenticated reasoning continuation token into this authority at the pause.
- `PendingMisreadSide` carries the same token as a UI/runtime projection.
- Runtime hydration requires authority/projection 1:1 equality, canonical live candidates,
  identity with the exact runtime object, and a graph-aware typed snapshot of the finalized
  pause-time full GameState; unsupported values, descriptors, cycles, and changed aliases fail closed.
- A same-owner resolver transition always rechecks Misread before the marker fast path;
  full legacy side-channel checks remain reserved for foreign/restore hydration.
- Resolver consumes authority inside the state transaction before applying picks.
- Terminal/replay/session cleanup invalidates both persisted authority and live lease.
- Do not use UI projection as execution authority.

## Verification gates

- Focused authority, public runtime, Misread QA, B05015, reasoning tests.
- Structurally similar pending-runtime and decision-owner regression tests.
- Typecheck, lint, build, docs generation/check, QA merge/lint.
- Full Vitest, smoke 1000, isolated relevant Playwright.
- Sol engine/adversarial review; BLOCK findings resolved.
- Clean release worktree rerun; `git diff --check`; local/remote divergence reported.

## Completion record

- Update adjudication shards only with exact executable evidence.
- Generate `.claude/auto/**`; never edit generated files manually.
- Record authority decision, horizontal findings, and separate B09016 bug.
- Commit one coherent Wave 26 change after all gates pass.
