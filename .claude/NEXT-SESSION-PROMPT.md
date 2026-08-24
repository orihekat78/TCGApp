# Next Task: batched QA adjudication Waves102-103

Resume `qa/adjudication-wave-20260814-13` after the Waves100-101 commit.

## Completed

- Waves100-101 certify six must-guard rows across B09040/PR290/PR296 and the
  physical B09040P spread.
- Public proof covers both owners, required/unavailable guards, and choosing
  exactly one of multiple legal must-guard characters.
- Coverage is 1661 matched / 1303 test-missing / 2964 total.
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

## Wave102 seed

- Exact tuple: section `577fab5535f861c63a2d6eb2eced5360b66ed584e1772ab5ee52278d1d4b2ba5`,
  Q `3a64dbf55e679dc4033b47b3c97d66026ce7dd1ad9de1baec36d4d8a1582b862`,
  A `391900cacc11940b4f3cf4cf75016c635360411e2fb2a7efea24ed3cebf7f64a`.
- Missing members: B05046, B07074, B09062.
- Ground first and preserve physical-printing equivalence.

## Wave103 seed

- Exact tuple: same section,
  Q `f02378790d5bd3c975d563a8b544575618156926828fa0e238457462fc194e50`,
  A `cf9e029f63dc02ea9b94a8e39361c805a3c0332630c8b9f13aed6e80abe4514c`.
- Missing members: B04048, PR099, PR105.
- Batch with Wave102 only after grounding proves a compatible public matrix.

## Estimate

- Snapshot: 1303 remaining items / 1114 exact groups; 949 groups are singleton.
- Remaining QA work: 77-149 working hours; center estimate about 112 hours.
