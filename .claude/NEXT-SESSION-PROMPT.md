# Next Task: card-completion QA Waves134-135

Resume `qa/adjudication-wave-20260814-13` after the Waves132-133 commit.

## Completed

- Wave132 finishes all six remaining B08049/P Q&A items.
- Wave133 finishes all six remaining B10036/P Q&A items.
- Coverage is 1781 matched / 1183 test-missing / 2964 total.
- Fresh authority remains 2257 printings / 2964 Q&A / zero conflicts.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves132-133 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves132-133.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave134: complete B10065/P/P2

- Certify all six remaining B10065-family Q&A items in one card matrix.
- Current suffix prefixes: `132b6ee607cc`, `15e4cae14b71`, `210502ad3cfa`,
  `9c441855706d`, `a8246c5912c2`, `f0e393b3a47a`.
- Cover all three physical definitions and both owners. Separate entry-trigger,
  optional turn-end chain, partner-area declaration, and Cut-In semantics.

## Wave135: complete B04048/P

- Certify all five remaining B04048-family Q&A items in one card matrix.
- Current suffix prefixes: `56d8adf38bad`, `812718039114`, `81ca9d0c5d23`,
  `b1c71ee07fa1`, `cc1f1a619e3e`.
- Cover both physical definitions and both owners. Separate hand-size-seven
  draw/return accounting from declared-name reveal, zero choice, ordering,
  short-deck, refresh, and visibility behavior.

## Gate carry-forward

- Full functional Vitest baseline: 1201 files / 12704 tests PASS.
- Release-only known failures: dirty-worktree fail-closed and protected pnpm
  `jose@6.2.9` allowlist. Do not mutate protected pnpm files.
- Full Playwright baseline: 451 PASS / 17 skip / 20 old Hirameki fixture
  failures; no Wave132-133 UI production change.
- Smoke baseline: 471/529, timeout0, exception0.

## Estimate

- Snapshot: 1183 remaining items / 1044 exact groups; 905 singleton groups.
- Remaining QA work: 68-132 working hours; center about 100 hours.
- Risk-aware batching forecast: roughly 54-94 implementation waves.
