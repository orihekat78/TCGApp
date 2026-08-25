# Next Task: batched QA adjudication Waves126-127

Resume `qa/adjudication-wave-20260814-13` after the Waves124-125 commit.

## Completed

- Wave124 certifies same-turn repeat guarding.
- Wave125 certifies stun remains ineligible despite sleep-guard permission.
- Public dispatch covers B09028, B09054, B09054P, and B10016 for both owners.
- Coverage is 1733 matched / 1231 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves124-125 session record.

## Throughput contract

- Batch semantically aligned items, but never merge different hashes or routes
  merely to reach a numeric target.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Waves126-127 are the next ten-wave checkpoint: after focused work, run full
  Vitest, full ESLint, smoke/baseline, required Playwright, both typechecks,
  QA merge/lint, generated docs, and diff-check once.
- Certification-only work normally uses no review agent. Any production or T3
  defect requires the applicable independent read-only review.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves124-125.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave126 batch: remaining B09028/B10016

- Exact group, B09028 + B10016: section `f414b60e...`, Q `90bb281a...`,
  A `93a9e843...`, suffix `31d03128...`; action target cannot guard itself.
- B09028 singleton: empty section, Q `2b45352f...`, A `95c0f2e7...`, suffix
  `994d30af...`; permission disappears when the live Osaka Police count drops.
- B09028 singleton: empty section, Q `deb2c51e...`, A `9a850b0a...`, suffix
  `c5a3cddd...`; this card counts itself toward its printed condition.
- B10016 singleton: same sleep-guard section, Q `6f2aebd0...`, A
  `4c5d26e9...`, suffix `ba833eaf...`; re-ground exact semantics before certify.
- Total: five Q&A items. Reuse the Waves122-125 public fixture where applicable.

## Wave127 batch: remaining B09054/P

- First declared ability: section `6cad8eda...`, Q `b29f48b9...`,
  A `9a850b0a...`, suffix `be26cfbb...`; self counts toward three Akai-family.
- Second declared ability: section `a29ad8b9...`, Q `4c83ae18...`,
  A `b0b5374a...`, suffix `80a2cfb1...`; active self-selection is legal.
- Same section, Q `d10e13b0...`, A `d8cdbcf9...`, suffix `c0c7a681...`;
  PA use and a newly entered scene UID have independent turn-one counters.
- Total: three Q&A items covering B09054 and B09054P physical rows.

## Gate carry-forward

- Known non-wave failures stay isolated to protected pnpm release gates and
  twenty old Hirameki fixtures; distinguish baseline failures from regressions.
- BUG-244 action-window fixtures remain green 10/10 after their prior correction.
- B09054/P header comments still call the PA clause vacuous; runtime wiring is
  correct. Treat this as stale documentation, not a behavior BLOCK.

## Estimate

- Snapshot: 1231 remaining items / 1090 exact groups; 949 groups are singleton.
- Remaining QA work: 72-137 working hours; center estimate about 105 hours.
- Risk-aware batching forecast: roughly 60-100 implementation waves.
