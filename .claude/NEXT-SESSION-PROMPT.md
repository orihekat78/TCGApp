# Next Task: card-completion QA Waves130-131

Resume `qa/adjudication-wave-20260814-13` after the Waves128-129 commit.

## Completed

- Wave128 finishes all nine remaining B09109/P Q&A items.
- Wave129 finishes all seven remaining B05007/P Q&A items.
- Coverage is 1757 matched / 1207 test-missing / 2964 total.
- Fresh authority remains 2257 printings / 2964 Q&A / zero conflicts.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves128-129 session record.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are mostly
  singleton or pairs and are not implementation-wave boundaries.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- The ten-wave full gate ran at Waves126-127. Next routine full gate is
  Waves136-137 unless production/T3 work requires it earlier.
- Certification-only work uses no review agent. Raise route on a production
  defect, rule conflict, or new engine path.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves128-129.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave130: complete B06020

- Certify all six remaining B06020-family Q&A items in one card matrix.
- Current suffix prefixes: `19859600f0b7`, `719ad960d0df`,
  `87ca22fac906`, `b50a8af517a6`, `d382a7fc6e47`,
  `d3b7730aa0d2`.
- Five items share section `577fab55...`; one adjacent item uses section
  `93b4b1d4...`.
- Inspect all physical rows and separate printed-effect, frame/icon, and public
  interaction assertions. Recheck any historical defer before certification.

## Wave131: complete B06074

- Certify all six remaining B06074-family Q&A items in one card matrix.
- Current suffix prefixes: `2e622a225c9c`, `4bcf1ca2a524`,
  `ae7f52880f24`, `b62596e6ff61`, `d3026efd67f9`,
  `e6ce2b727de1`.
- Ground all section variants independently and preserve physical-printing
  coverage. Do not reuse an answer solely because another card has the same
  question hash.

## Gate carry-forward

- Full functional Vitest baseline: 1201 files / 12704 tests PASS.
- Release-only known failures: dirty-worktree fail-closed and protected pnpm
  `jose@6.2.9` allowlist. Do not mutate protected pnpm files.
- Full Playwright baseline: 451 PASS / 17 skip / 20 old Hirameki fixture
  failures; no Wave128-129 UI production change.
- Smoke baseline: 471/529, timeout0, exception0.

## Estimate

- Snapshot: 1207 remaining items / 1068 exact groups; 929 singleton groups.
- Remaining QA work: 70-134 working hours; center about 102 hours.
- Risk-aware batching forecast: roughly 58-98 implementation waves.
