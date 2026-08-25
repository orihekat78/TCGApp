# Next Task: batched QA adjudication Waves118-119

Resume `qa/adjudication-wave-20260814-13` after the Waves116-117 commit.

## Completed

- Wave116 certifies arbitrary multi-Misread commitments for D06015/PR027/PR031
  across both owners, 0/1/2/3 sources, partner reasoning, and zero controls.
- Wave117 certifies PR060/PR064/PR154 count stun for the entry gate but permit
  only sleep removal targets across both owners, either side, decoys, and zero.
- Coverage is 1709 matched / 1255 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves116-117 session record.

## Throughput contract

- Batch semantically aligned items, but never merge different hashes or routes
  merely to reach a numeric target.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- The ten-wave full checkpoint ran at Waves116-117. Next routine full gate is
  Waves126-127 unless T3/public-flow work requires it earlier.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves116-117.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave118 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `9a53219dce3c225a9c208d3e02a076c5f40adbb3bae3c3bce1098f01e259d555`,
  A `f813540a43fdb01e639a009712ef2d2b34e9e6fb52586365f4f90f94a0cf1f85`.
- Missing exact-group members: B04089, B04091, B04094.
- Ground all three members before changing adjudication.

## Wave119 seed

- Exact tuple: section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  Q `e5a1d5c8890805960d9d41a86065d041e9871a138762795f3aba66d37a658162`,
  A `d8cdbcf96cb81df73a04d13e77d97991d6dcaf5d6b1e012bc710edcd408f0a04`.
- Missing exact-group members: B04027, B04042, B04084.
- Ground all three members before changing adjudication.

## Gate carry-forward

- Full functional Vitest, full ESLint, smoke, and both-project Playwright were
  exercised at Waves116-117. Known non-wave failures remain isolated to the
  protected pnpm release gates and twenty old Hirameki pattern fixtures.
- BUG-244 Hirameki action-window fixtures were corrected and pass 10/10.

## Estimate

- Snapshot: 1255 remaining items / 1098 exact groups; 949 groups are singleton.
- Remaining QA work: 74-141 working hours; center estimate about 108 hours.
