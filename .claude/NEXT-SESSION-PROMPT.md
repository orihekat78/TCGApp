# Next Task: batched QA adjudication Waves104-105

Resume `qa/adjudication-wave-20260814-13` after the Waves102-103 commit.

## Completed

- Wave102 certifies repeated paid declarations without a turn limit.
- Wave103 certifies identifiable card-name input and fixes BUG-358 across
  human, AI, save, replay, resolver, and B04048/P deck matching.
- Coverage is 1667 matched / 1297 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves102-103 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes/routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: both typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Latest T3 gate is Waves102-103.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves102-103.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave104 seed

- Exact tuple: section `5d92283f61c8d30aa691b138f172742b0dde09130eb49a0961df0a9550cb3b59`,
  Q `fb1e1b4816c5e5309348a517d102ea19c077ba890f6709a49a7ccaab7e1afbf7`,
  A `fde7928eb6cbb6cc346d4b7a2824d799f67fd3a8f84c37f26c75fc4bc43f2e51`.
- Missing members: B05055, B06090, B10056.
- Ground first and preserve physical-printing equivalence.

## Wave105 seed

- Exact tuple: section `5fcfb3b6e315fc230928eee3b27a1ba2624c90c932889c54aff9a4aba30053eb`,
  Q `2db9e3e13d0793841ee7e2adeb82b6eb7ee6c5372b9b2c1d8666ed64c8d51fb1`,
  A `2818fdd5a6774029d339e10e4777a5eb614b989d1d530f76ea66008b4ba4f201`.
- Missing members: B09003, B09108, B09111.
- Batch with Wave104 only after grounding proves a compatible public matrix.

## Estimate

- Snapshot: 1297 remaining items / 1112 exact groups; 949 groups are singleton.
- Remaining QA work: 77-148 working hours; center estimate about 112 hours.
