# Next Task: batched QA adjudication Waves124-125

Resume `qa/adjudication-wave-20260814-13` after the Waves122-123 commit.

## Completed

- Wave122 certifies ordinary sleep transition after an active bearer guards.
- Wave123 certifies Bullet priority over sleep-guard permission.
- Public dispatch covers B09028, B09054, B09054P, and B10016 for both owners.
- Coverage is 1727 matched / 1237 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves122-123 session record.

## Throughput contract

- Batch semantically aligned items, but never merge different hashes or routes
  merely to reach a numeric target.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- The ten-wave full checkpoint ran at Waves116-117. Next routine full gate is
  Waves126-127 unless T3/public-flow work requires it earlier.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves122-123.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave124 seed

- Exact tuple: section `f414b60e12d2ea28b6dccfbe327a56a72e8c2db37fa11cb57994e0e081fc3fea`,
  Q `966dab87eef807a86a633236741fd8add956c7de1e2345e4a8174890ec545550`,
  A `22cf72497c12e4979f2dbd0c277552e3e126cdc6f68932e8f3809d54cedd206d`.
- Missing exact-group members: B09028, B09054, B10016.
- Meaning is already grounded: guard has no per-turn count; the same bearer may
  guard again whenever still eligible. Add exact card-bound public proof.

## Wave125 seed

- Exact tuple: same section,
  Q `d4c1eaa0702bafa60c52209ba60bad9511e313b486777ab0ad8b3dee64021502`,
  A `bd8ba0906b846951b1a95016cb399d87e80742e52516329bd932fb0f62ee3713`.
- Missing exact-group members: B09028, B09054, B10016.
- Meaning is already grounded: stun remains ineligible despite sleep-guard
  permission. Reuse the Waves122-123 fixture and keep this hash separate.

## Gate carry-forward

- Waves116-117 exercised the ten-wave full checkpoint. Known non-wave failures
  stay isolated to protected pnpm release gates and twenty old Hirameki fixtures.
- BUG-244 action-window fixtures remain green 10/10 after their prior correction.
- B09054/P header comments still call the PA clause vacuous; runtime wiring is
  correct. Treat this as stale documentation, not a behavior BLOCK.

## Estimate

- Snapshot: 1237 remaining items / 1092 exact groups; 949 groups are singleton.
- Remaining QA work: 73-138 working hours; center estimate about 106 hours.
- Risk-aware batching forecast: roughly 60-100 implementation waves.
