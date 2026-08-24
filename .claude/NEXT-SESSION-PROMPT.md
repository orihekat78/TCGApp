# Next Task: batched QA adjudication Waves94-95

Resume `qa/adjudication-wave-20260814-13` after the Waves92-93 commit.

## Completed

- Wave92 certifies owner-only scene costs for B04019/B07025/B07079/B07080,
  including B07079P/B07080P and owner-opp public paths.
- Wave93 certifies action-end source presence for B04030/B06077/PR289/PR295,
  including B04030P/B06077P public action paths.
- Coverage is 1626 matched / 1338 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Read-only official sync now reports new PR322 plus Q&A drift for
  B04018/B04018P/B06103P. Keep this separate from Waves94-95 unless re-queued.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Gate evidence is in the Waves92-93 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves92-93.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch required packages into an isolated temp
   root; never modify live `.claude/specs/cards-data`.

## Wave94 seed

- Exact tuple: Q `b79714d353b8489064452c19390fab29106faecf289d66c7f7d6b70cceeaa92d`,
  A `72f763acbcebae843d584269562044d5aacaf6534790c089bfa9df0b90cb10fb`,
  section `93b4b1d410b3d03e079cbf9f9e8000765e121a2b773e6d0ad785e8f2c240729c`.
- Missing members: B08038, D11007, D11008, PR304.
- Ground first, then expand only adjacent rows sharing the exact primitive.

## Wave95 seed

- Exact tuple: Q `790579b0273f2928145c049c606342b0f0bc9b16d3cea3e3f1c654e6cae6b9d8`,
  A `188711a1925166b73d3fc85103fbe567257d32c6135ffc69f33c6cba408a46b3`,
  section `ae447b04b2937795dd9e80cb022a1c40238ce754e790755a5bfbd2e1ae6e9f30`.
- Missing members: B07060, PR195, PR196, PR297.
- Keep separate from Wave94 until fresh grounding proves reuse.

## Estimate

- Snapshot: 1338 remaining items / 1125 exact groups; 949 groups are singleton.
- Remaining QA work: 80-153 working hours; center estimate about 116 hours.
