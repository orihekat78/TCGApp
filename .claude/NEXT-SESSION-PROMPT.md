# Next Task: batched QA adjudication Waves92-93

Resume `qa/adjudication-wave-20260814-13` after the Waves90-91 commit.

## Completed

- Wave90 certifies D11003-D11006 exact case-condition rows.
- BUG-355 uses exact `婚活パーティー` identity across CardDefs, public catalog,
  tests, and specs; shortened `婚活` no longer satisfies the icon.
- BUG-356 replaces D11005/D11006 fixed AP/custom closure with serializable
  `apMaxSource:true`, honoring effective AP at resolution.
- Wave91 certifies the optional mill-three short-deck group through public
  dispatch, including PR207/PR285/B10096P physical paths.
- Coverage is 1618 matched / 1346 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Read-only official sync now reports new PR322 plus Q&A drift for
  B04018/B04018P/B06103P. Keep this separate from Waves92-93 unless re-queued.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Gate evidence is in the Waves90-91 session record.

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
3. Read `.claude/sessions/2026-08-24-qa-waves90-91.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Fetch required packages into an isolated temp
   root; never modify live `.claude/specs/cards-data`.

## Wave92 seed

- Exact tuple: Q `d16e06226253b0266071bb23fb2610107c080feaaa0d9391dff8daf51b523f94`,
  A `45979cb61275514a31c0e89b0df5a48215e8c3e34e6e49457a0a2c82fd481c80`,
  section `1d1a726d51f8e15c5aad00c2f0ef4af5d5cbf3883a1c4ee178f7838c2035550a`.
- Missing members: B04019, B07025, B07079, B07080.
- Ground first, then expand only adjacent rows sharing the exact primitive.

## Wave93 seed

- Exact tuple: Q `b1e45192009f9f339e509f63e204115cc64e64fd441418793bc87ca1bb9dd543`,
  A `9c0db2a38965deffd47636c93cae43b0d982f74ebba0f3cfb2444876c95e59f4`,
  section `7893e9f384661c3bff3048afff9f7cbba0aa413bdab0cef2616fa40ffe763936`.
- Missing members: B04030, B06077, PR289, PR295.
- Keep separate from Wave92 until fresh grounding proves reuse.

## Estimate

- Snapshot: 1346 remaining items / 1127 exact groups; 949 groups are singleton.
- Remaining QA work: 81-154 working hours; center estimate about 117 hours.
