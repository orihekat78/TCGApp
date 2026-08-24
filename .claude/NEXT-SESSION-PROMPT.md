# Next Task: batched QA adjudication Waves108-109

Resume `qa/adjudication-wave-20260814-13` after the Waves106-107 commit.

## Completed

- Wave106 certifies B03018/B05077/B05101 opponent-turn removal behavior.
- Wave107 fixes BUG-360 across B09052/P and B09112/P name supply and old-save
  migration, then certifies combined-name consumers B09108/P-B09112/P.
- Coverage is 1679 matched / 1285 test-missing / 2964 total.
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
  changes, or before publication. Latest T3 gate is Waves106-107.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves106-107.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave108 seed

- Exact tuple: section `7822351767bd7e5a726669f512bf5c1f438f615927bb96e4da425ed43a12b06d`,
  Q `52bf2f1282fa1c20d600c1d8aca50040415fd695416b15cdec762432a990fb73`,
  A `f6c226c9a8e60ffc02bb71841873f3699503d6ec963820f1d141f7c2946d45d1`.
- Missing exact-group members: PR247, PR262, PR268.
- Ground all three members before changing adjudication.

## Wave109 seed

- Exact tuple: section `93b4b1d410b3d03e079cbf9f9e8000765e121a2b773e6d0ad785e8f2c240729c`,
  Q `d228cd81309e6431272b2333ef042221a46555004d5f331ad9f12f1f368f17a8`,
  A `33f0805905c079ade93217d4dc82e0041bd476996e960b67128f752042900dff`.
- Missing exact-group members: D11007, D11008, PR304.
- Ground all three members before changing adjudication.

## Estimate

- Snapshot: 1285 remaining items / 1108 exact groups; 949 groups are singleton.
- Remaining QA work: 76-146 working hours; center estimate about 111 hours.
