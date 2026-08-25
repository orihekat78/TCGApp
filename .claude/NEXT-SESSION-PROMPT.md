# Next Task: batched QA adjudication Waves120-121

Resume `qa/adjudication-wave-20260814-13` after the Waves118-119 commit.

## Completed

- Wave118 certifies B04089/P, B04091/P, and B04094/P trigger after owner-effect
  opposing removal but never after contact, across both owners and all outcomes.
- Wave119 certifies choosing exactly one across B04027/P, B04042/P, and B04084,
  with zero/max/aggregate rejection and B04084 continuation cleanup.
- Coverage is 1715 matched / 1249 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves118-119 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves118-119.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave120 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `ec46e0d5d240618fe1ff0da6bf613a4112a59cbcb2fe387b300d410e6088cb16`,
  A `b266e93764f8203e56a49d78836a15a2fd50a14d01ad2d10c1d7f894b05c474e`.
- Missing exact-group members: D06003, D06004, D06021.
- Ground all three members before changing adjudication.

## Wave121 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `f70dca6d863c38348fdcedfafa0431d49b150f39c4ad5f90e4dd2d9b641db2d6`,
  A `bc06b45c77b553b94d7406a9e439b81183696c446e50547af0d7ca1748470faf`.
- Missing exact-group members: B10007, B10012, B10013.
- Ground all three members before changing adjudication.

## Gate carry-forward

- Waves116-117 exercised the ten-wave full checkpoint. Known non-wave failures
  stay isolated to protected pnpm release gates and twenty old Hirameki fixtures.
- BUG-244 action-window fixtures remain green 10/10 after their prior correction.

## Estimate

- Snapshot: 1249 remaining items / 1096 exact groups; 949 groups are singleton.
- Remaining QA work: 74-140 working hours; center estimate about 108 hours.
