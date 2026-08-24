# Next Task: batched QA adjudication Waves100-101

Resume `qa/adjudication-wave-20260814-13` after the Waves98-99 commit.

## Completed

- Wave98 certifies assisted-partner FILE7 counting for B04023/D09014/D09015.
- Wave99 certifies static unlimited-copy rules and the fixed 40-card total for
  B09100/PR158/PR164.
- Coverage is 1655 matched / 1309 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves98-99 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes/routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: both typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Latest T3 gate remains Waves96-97.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves98-99.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave100 seed

- Exact tuple: section `577fab5535f861c63a2d6eb2eced5360b66ed584e1772ab5ee52278d1d4b2ba5`,
  Q `2582052cf20fcce0d5f5f98b296dbb937f96e8597c1f38ae9caacba349d43261`,
  A `8268b668022a014b601e117aef5157e38707e866bee200e2daddd40cf1e0ea32`.
- Missing members: B09040, PR290, PR296.
- Ground first and preserve physical-printing equivalence.

## Wave101 seed

- Exact tuple: same section,
  Q `2b8a269ce1d86fc646c7cd9379984b53add26c0e8eee7d896c9592e7bbb03ef5`,
  A `ffe0b792b1620c0d14dd6e2ac0775e67623c57fa1159f9e7ff7978fcb4f8d7d0`.
- Missing members: B09040, PR290, PR296.
- Batch with Wave100 only after grounding proves one shared behavior matrix.

## Estimate

- Snapshot: 1309 remaining items / 1116 exact groups; 949 groups are singleton.
- Remaining QA work: 77-150 working hours; center estimate about 113 hours.
