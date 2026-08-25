# Next Task: batched QA adjudication Waves122-123

Resume `qa/adjudication-wave-20260814-13` after the Waves120-121 commit.

## Completed

- Wave120 certifies D06003/D06004/D06021 retrieve only effective AP-plus Cut-In
  text from the owner remove area, with both-owner and decoy controls.
- Wave121 certifies B10007/P, B10012/P, and B10013/P keep face-down set identity
  hidden on entry and opaque movement for both owners.
- Coverage is 1721 matched / 1243 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves120-121 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves120-121.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave122 seed

- Exact tuple: section `f414b60e12d2ea28b6dccfbe327a56a72e8c2db37fa11cb57994e0e081fc3fea`,
  Q `26e51a9ee5be1b007c21ca690657250a977b14b2d3ad31039b36d9b2c75b12cf`,
  A `aedd1fae8cb5d370350b8c5d65d957a9153744872951b43f93124ba8a5aa1d38`.
- Missing exact-group members: B09028, B09054, B10016.
- Ground all three members and the adjacent exact tuples before adjudication.

## Wave123 seed

- Exact tuple: section `f414b60e12d2ea28b6dccfbe327a56a72e8c2db37fa11cb57994e0e081fc3fea`,
  Q `4506935e0a047963a823e70eb8b354d376b6843e15d6475425bcd130b54a4629`,
  A `73a6f00663f191761324ed9f7ff894295dbebe8b28371c1db514b6e292884657`.
- Missing exact-group members: B09028, B09054, B10016.
- Keep it separate from the two later same-card tuples unless exact hashes and
  semantics are independently grounded.

## Gate carry-forward

- Waves116-117 exercised the ten-wave full checkpoint. Known non-wave failures
  stay isolated to protected pnpm release gates and twenty old Hirameki fixtures.
- BUG-244 action-window fixtures remain green 10/10 after their prior correction.

## Estimate

- Snapshot: 1243 remaining items / 1094 exact groups; 949 groups are singleton.
- Remaining QA work: 74-139 working hours; center estimate about 107 hours.
