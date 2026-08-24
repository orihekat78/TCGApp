# Next Task: batched QA adjudication Waves110-111

Resume `qa/adjudication-wave-20260814-13` after the Waves108-109 commit.

## Completed

- Wave108 certifies multiple simultaneous Misread commitments plus uncapped,
  optional set guidance for PR247/PR262/PR268 across both owners.
- Wave109 certifies post-effect contact AP order for D11007/D11008/PR304,
  including accept, decline, zero-hand, both owners, and scope expiry.
- Coverage is 1685 matched / 1279 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves108-109 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes or routes merely to reach the count.
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
3. Read `.claude/sessions/2026-08-25-qa-waves108-109.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave110 seed

- Exact tuple: section `9e88cb5d4113c7fd585835e24d289615ec8309ca14a85e08434073bcf182bda7`,
  Q `7ac51d8c7b926288a8dbbb61cda12a9834f42cdc5f6693733f2f57696c4f6848`,
  A `3ef97efe6e461ba6b4a5f8bba236edd1078298c43d05f2c5ec145c0ec58c2282`.
- Missing exact-group members: B07031, B07034, B07052.
- Ground all three members before changing adjudication.

## Wave111 seed

- Exact tuple: section `afb883b98a982a500934550cf3fdb6fa976325b6885be8679ccb0d868df55fc2`,
  Q `e01e71cb6976e1c4d4c60f62e15b3246bdd03f1b1ef05f8f27fc75fe689a2c3c`,
  A `b9faf8f17f1bc23ab3afe80b636d314a04ad55b9846a3d1641f8b898c3bd308d`.
- Missing exact-group members: B08079, B08084, B08089.
- Ground all three members before changing adjudication.

## Estimate

- Snapshot: 1279 remaining items / 1106 exact groups; 949 groups are singleton.
- Remaining QA work: 76-145 working hours; center estimate about 110 hours.
