# Next Task: batched QA adjudication Waves116-117

Resume `qa/adjudication-wave-20260814-13` after the Waves114-115 commit.

## Completed

- Wave114 certifies 0/1/2 selection for B01022/PR042/PR046 across both owners,
  with limit, filter, reveal-window, optional-payment, and empty-candidate proof.
- Wave115 certifies exact one-card owner-hand costs for B01007/B01088/D02013,
  including atomic invalid payment, identity, effect ordering, and turn limits.
- Coverage is 1703 matched / 1261 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves114-115 session record.

## Throughput contract

- Batch semantically aligned items, but never merge different hashes or routes
  merely to reach a numeric target.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Latest T3 gate is Waves106-107.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves114-115.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave116 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `50c04838bb6eab70583a8c16bbdb6f255bc00340b440d0fccf07f1292e03210f`,
  A `4c8d0ca99cf571a16514ffdd00a8e799ce732b57c6ef00d3e9049b7e4b2d9b94`.
- Missing exact-group members: D06015, PR027, PR031.
- This is a different Q&A identity from Wave113. Ground it independently.

## Wave117 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `58570773a8801cdeb5a0460fdf0080e395efd7252885a1abef186f6aa01845b6`,
  A `bd8ba0906b846951b1a95016cb399d87e80742e52516329bd932fb0f62ee3713`.
- Missing exact-group members: PR060, PR064, PR154.
- Ground all three members before changing adjudication.

## Estimate

- Snapshot: 1261 remaining items / 1100 exact groups; 949 groups are singleton.
- Remaining QA work: 75-142 working hours; center estimate about 109 hours.
