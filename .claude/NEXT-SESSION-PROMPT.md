# Next Task: batched QA adjudication Waves98-99

Resume `qa/adjudication-wave-20260814-13` after the Waves96-97 commit.

## Completed

- Wave96 certifies arbitrary-position evidence costs for
  B06023/B07077/B08030, including both variants and owners.
- BUG-357 preserves exact causal authority when a host-witness declared effect
  opens a queue-prewalk human decision.
- Wave97 certifies select-but-block-remove, non-remove effects, and event
  Hirameki removal across B10010/B10011/PR279.
- Coverage is 1646 matched / 1318 test-missing / 2964 total.
- Fresh isolated authority remains 2964 Q&A / zero conflicts.
- Protected `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and live cards-data remain
  untouched. Full evidence is in the Waves96-97 session record.

## Throughput contract

- Batch 20-30 semantically aligned items per ordinary wave. Never merge
  different hashes/routes merely to reach the count.
- Per-wave: focused behavioral tests plus a narrow QA shape check only.
- Two-wave checkpoint: both typechecks, focused ESLint, QA merge/lint,
  generated-Q&A check, diff-check, then one commit and one push.
- Full Vitest/lint/smoke/Playwright only every ten waves, on T3/public-flow
  changes, or before publication. Waves96-97 just completed the latest T3 gate.
- Certification-only waves normally use no review agent. Independent review is
  allowed when useful, with a strict maximum of three subagents.
- Hand off after the two-wave checkpoint under the context limit.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves96-97.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue. Revalidate the isolated authority root and
   never modify live `.claude/specs/cards-data`.

## Wave98 seed

- Exact tuple: section `2a0e8368dbc6a561ac30f3763b29fd0658c44e15eb1547e81510f1d0e40dbb50`,
  Q `8fa4b8e71215f62c49416848020e7bd9fdcc800d7a3d9d4f2cf84d9e447f0eaf`,
  A `ba588ce24702c1524b7adc56ae88fa31d452d556cd11a7e2f7b6430215be9343`.
- Missing members: B04023, D09014, D09015.
- Ground first, then expand only adjacent rows sharing the exact primitive.

## Wave99 seed

- Exact tuple: section `4e51b05320b77353996d016d204e9d8c35d565759c2338101d56a34874fcecd2`,
  Q `34c19eeaff05a9880dde4bc8d0805d6e253d78fdcd5283eff10fac55eaef9c59`,
  A `7f10b8f443d9a90838f9e9ede13e4ed6f2a0203c23b020010145b928ce2458e6`.
- Missing members: B09100, PR158, PR164.
- The same cards have adjacent tuple Q `a0282d67...`, A `2cfc332d...`.
  Batch both only after fresh grounding proves one shared behavior matrix.

## Estimate

- Snapshot: 1318 remaining items / 1119 exact groups; 949 groups are singleton.
- Remaining QA work: 78-151 working hours; center estimate about 114 hours.
