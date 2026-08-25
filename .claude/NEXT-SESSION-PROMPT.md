# Next Task: card-completion QA Waves128-129

Resume `qa/adjudication-wave-20260814-13` after the Waves126-127 commit.

## Completed

- Wave126 finishes five remaining B09028/B10016 Q&A items.
- Wave127 finishes three remaining B09054/P Q&A items.
- Coverage is 1741 matched / 1223 test-missing / 2964 total.
- Fresh authority remains 2257 printings / 2964 Q&A / zero conflicts.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves126-127 session record.

## Throughput contract

- Exact groups are now at most pairs and 943/1083 are singleton. Prefer a
  complete-card batch of 5-15 grounded items over one exact group per wave.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- The ten-wave full gate ran at Waves126-127. Next routine full gate is
  Waves136-137 unless production/T3 work requires it earlier.
- Certification-only work uses no review agent. Raise route if a production
  defect, rule conflict, or new engine path appears.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves126-127.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave128: complete B09109

- Certify all nine remaining B09109-family Q&A items in one card matrix.
- Current suffix prefixes: `14ada03fa9ae`, `212da49cce2a`,
  `62957e90ade0`, `636d66e72f92`, `80a2cfb16a87`,
  `87aa9ca394d3`, `c025e65ad44b`, `c7a68e13ec1b`,
  `d6aea3c6390f`.
- Six items share section `6cad8eda...`; three share `a29ad8b9...`.
- Inspect B09109/P physical rows, existing S1-defer probes, PA scope, public
  decisions, and exact answer variants. Do not group-equivalent by shape alone.

## Wave129: complete B05007

- Certify all seven remaining B05007-family Q&A items in one card matrix.
- Current suffix prefixes: `019c31932bdd`, `03ab9e398646`,
  `1326a9294ee6`, `56b2d90b6856`, `64c8ea1dbd68`,
  `8e1da005d761`, `f81037b5ce4f`.
- Five items share section `577fab55...`; two are adjacent frame-rule items.
- Inspect every physical printing and keep card-text, icon/frame, and public
  interaction assertions distinct.

## Gate carry-forward

- Full functional Vitest baseline: 1201 files / 12704 tests PASS.
- Release-only known failures: dirty-worktree fail-closed and protected pnpm
  `jose@6.2.9` allowlist. Do not mutate protected pnpm files.
- Full Playwright baseline: 451 PASS / 17 skip / 20 old Hirameki fixture
  failures, all `actionDeclareCase not-allowed`; no Wave126-127 regression.
- Smoke baseline: 471/529, timeout0, exception0.

## Estimate

- Snapshot: 1223 remaining items / 1083 exact groups; 943 singleton groups.
- Remaining QA work: 71-136 working hours; center about 104 hours.
- Risk-aware batching forecast: roughly 59-99 implementation waves.
