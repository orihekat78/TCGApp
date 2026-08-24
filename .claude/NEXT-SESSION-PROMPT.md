# Next Task: batched QA adjudication Waves112-113

Resume `qa/adjudication-wave-20260814-13` after the Waves110-111 commit.

## Completed

- Wave110 certifies exact owner-relative 【事件赤魔術】 gates for five physical
  B07031/B07034/B07052 printings.
- Wave111 certifies leave-source refresh membership for four physical
  B08079/B08084/B08089 printings across both owners and zero/nonzero controls.
- Coverage is 1691 matched / 1273 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves110-111 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves110-111.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave112 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `09b586153c1bb2034273085ffa6fb352b2325b0d7ee3e0179259ee896346980e`,
  A `18ed0c93472b7b370de36474781dc98cb78137a0733cf4c3d679e1be519899ee`.
- Missing exact-group members: B03112, B03118, B09086.
- Ground all three members before changing adjudication.

## Wave113 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `0f05cb5ea8c693189608d5cd636cf11d4e14120fc537a0af0eb739a0924d47aa`,
  A `9774db2bba11e1d8d8eb55ecaab030d2da5bec33b33e7ee366cc4ddf59c1cdc0`.
- Missing exact-group members: D06015, PR027, PR031.
- Ground all three members before changing adjudication.

## Estimate

- Snapshot: 1273 remaining items / 1104 exact groups; 949 groups are singleton.
- Remaining QA work: 75-144 working hours; center estimate about 110 hours.
