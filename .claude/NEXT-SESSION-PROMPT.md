# Next Task: batched QA adjudication Waves106-107

Resume `qa/adjudication-wave-20260814-13` after the Waves104-105 commit.

## Completed

- Wave104 proves Hirameki cannot select its own source before that source enters
  remove, while another matching removed character remains legal.
- Wave105 fixes BUG-359 for B09003/P, B09108/P, and B09111/P. Registered
  all-card names now work across UI, AI, save hydration, replay, and resolver.
- Coverage is 1673 matched / 1291 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves104-105 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes or routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Latest T3 gate is Waves104-105.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves104-105.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave106 seed

- Exact tuple: section `9839123858bef7bacd9f63d88ef2690dc2cce149064a4924dbd2253df5ece373`,
  Q `3e9b9e801fb001be09d143ab029c12f2458acdde4eaffc0b25a757f2fbb5aa28`,
  A `bd1021263916b76aa59508c6813bbffe73c698f6db8511f6e09c600022e7d446`.
- Missing members: B03018, B05077, B05101.
- Ground all 51 exact-group members before reusing the existing 48 matches.

## Wave107 seed

- Exact tuple: section `5fcfb3b6e315fc230928eee3b27a1ba2624c90c932889c54aff9a4aba30053eb`,
  Q `c5a0fed53850995d13a05ba1f5f33c1fdacf046acfbb3d26a1d962c61df7bab8`,
  A `3182fdb3d7835f2e4a486f1278adbb707f2bf68821439f73378f908b5fb96f97`.
- Missing members: B09108, B09111, B09112; two exact members already matched.
- This is not Wave105's declaration-name Q&A. Ground its exact semantics anew.

## Estimate

- Snapshot: 1291 remaining items / 1110 exact groups; 949 groups are singleton.
- Remaining QA work: 76-147 working hours; center estimate about 111 hours.
