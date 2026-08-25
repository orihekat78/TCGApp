# Next Task: card-completion QA Waves132-133

Resume `qa/adjudication-wave-20260814-13` after the Waves130-131 commit.

## Completed

- Wave130 finishes all six remaining B06020 Q&A items.
- Wave131 finishes all six remaining B06074/P Q&A items.
- Coverage is 1769 matched / 1195 test-missing / 2964 total.
- Fresh authority remains 2257 printings / 2964 Q&A / zero conflicts.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves130-131 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves130-131.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave132: complete B08049/P

- Certify all six remaining B08049-family Q&A items in one card matrix.
- Current suffix prefixes: `190baa1e1f03`, `6da58a7c708a`, `adeccaf4d2c5`,
  `b6cd283a3bf7`, `f0398d124b6f`, `f34bda62bcbe`.
- Cover both physical definitions, both owners, turn-end FBI counting, draw,
  declared turn limit, sleep cost, prior action history, and active-state pick.

## Wave133: complete B10036/P

- Certify all six remaining B10036-family Q&A items in one card matrix.
- Current suffix prefixes: `0b75452df615`, `0e3dfbcf73fb`, `19859600f0b7`,
  `3aa4146f97fd`, `a3b35ffcf4a5`, `fcd5db872cd3`.
- Cover both physical definitions, both owners, exact dual picks, sleep/self
  exclusion, generated-contact attacker identity, no guard, and contact hooks.

## Gate carry-forward

- Full functional Vitest baseline: 1201 files / 12704 tests PASS.
- Release-only known failures: dirty-worktree fail-closed and protected pnpm
  `jose@6.2.9` allowlist. Do not mutate protected pnpm files.
- Full Playwright baseline: 451 PASS / 17 skip / 20 old Hirameki fixture
  failures; no Wave130-131 UI production change.
- Smoke baseline: 471/529, timeout0, exception0.

## Estimate

- Snapshot: 1195 remaining items / 1056 exact groups; 917 singleton groups.
- Remaining QA work: 69-133 working hours; center about 101 hours.
- Risk-aware batching forecast: roughly 56-96 implementation waves.
