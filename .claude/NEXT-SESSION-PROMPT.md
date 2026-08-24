# Next Task: batched QA adjudication Waves88-89

Resume `qa/adjudication-wave-20260814-13` after the Waves86-87 commit.

## Completed

- Wave86 certifies 20 event-use Q&A items across source authorization, FILE
  waiver, observer timing, effect provenance, destination, and use bans.
- Wave87 certifies 15 Investigation count/found/short-deck/order items.
- BUG-351 fixes B03096 at `reasoning:after-sleep` and canonicalizes `souza`.
- BUG-352 makes B08074 wait for defender reorder before found-count grants.
- Coverage is 1568 matched / 1396 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Final gate evidence is in the Waves86-87 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Do not treat
  different hashes/routes as equivalent merely to reach the count.
- Ordinary gates: focused tests, both typechecks, focused ESLint, QA
  merge/lint, generated-Q&A check, and diff-check.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Do not rerun unchanged green gates.
- Commit and push after two implementation waves, then hand off.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves86-87.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch required packages into an isolated temp
   root; never modify live `.claude/specs/cards-data`.

## Wave88 seed

- Exact tuple: Q `6a9286d450d473ac5254c1ecde68d3b1cf6e197533d7b0e2a7a3606f898f44a5`,
  A `6600f74d7b70f2a1044d39d7aff9c8f16ea5257fe4739943b8ddb87cf06fa515`,
  section `577fab5535f861c63a2d6eb2eced5360b66ed584e1772ab5ee52278d1d4b2ba5`.
- Missing members: B08006, B08008, B09048, PR289, PR295.
- Ground the official text first, then expand only adjacent same-primitive rows.

## Wave89 seed

- Exact tuple: Q `74968c3b0c2a68ec5b4218d0f9c0160ca36665ce21f649e62996f91468964bfa`,
  A `9a850b0aa69167d50fe9b35374145bd3a1f7c6ca2159ee4d9315b205401b53c5`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Missing members: B04027, B04047, B04064, B05067.
- Keep separate from Wave88 until fresh grounding proves shared semantics.

## Estimate

- Snapshot: 1396 remaining items / 1156 exact groups; 967 groups are singleton.
- All remaining QA work: 115-215 hours under the batched cadence.
