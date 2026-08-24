# Next Task: batched QA adjudication Waves90-91

Resume `qa/adjudication-wave-20260814-13` after the Waves88-89 commit.

## Completed

- Wave88 certifies 22 stacked-card rows across lifecycle, exact choice,
  thresholds, continuous AP, action timing, cascade, informationlessness, and MR.
- BUG-353 exposes modern exact stack identities for legal inspection/selection
  while keeping rules evaluation informationless and legacy unknowns hidden.
- BUG-354 gates stale stack resolutions and preserves set-card replacement
  continuations before B06008 draw or D10009/D10010 Assault tails.
- Wave89 certifies 20 assisted-partner FILE count/top-movement rows through real
  assist and card dispatch paths, including every physical variant.
- Coverage is 1610 matched / 1354 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Read-only official sync now reports new PR322 plus Q&A drift for
  B04018/B04018P/B06103P. Keep this separate from Waves90-91 unless re-queued.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Gate evidence is in the Waves88-89 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes/routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: both typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Do not repeat a green unchanged gate.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves88-89.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch required packages into an isolated temp
   root; never modify live `.claude/specs/cards-data`.

## Wave90 seed

- Exact tuple: Q `7ac51d8c7b926288a8dbbb61cda12a9834f42cdc5f6693733f2f57696c4f6848`,
  A `240d9989d84b1446fdf8446d85b4f07e316976c39088c96ba345975e0ba2ccaf`,
  section `0267a4565a1830e9dd372eaa9b4064963293ba9b568ac7a47314f03550f6fab7`.
- Missing members: D11003, D11004, D11005, D11006.
- Ground first, then expand only adjacent rows sharing the exact primitive.

## Wave91 seed

- Exact tuple: Q `fc92aa0e06397d980ce911990fe909721a45b221ca712ff70bbb1bc3d4b81df6`,
  A `09ac3974741d3f1b11af49f9784152184c91bbaa96972834da09effd62d3f59f`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Missing members: B05068, PR132, PR207, PR285.
- Keep separate from Wave90 until fresh grounding proves reuse.

## Estimate

- Snapshot: 1354 remaining items / 1129 exact groups; 949 groups are singleton.
- Remaining QA work: 82-155 working hours; center estimate about 118 hours.
