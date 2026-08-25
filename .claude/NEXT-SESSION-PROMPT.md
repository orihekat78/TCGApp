# Next Task: card-completion QA Waves142-143

Resume `qa/adjudication-wave-20260814-13` after the Waves140-141 commit.

## Completed

- Wave140 finishes all five remaining B10003/P Q&A items.
- Wave141 finishes all five remaining B10098/P Q&A items.
- Coverage is 1822 matched / 1142 test-missing / 2964 total.
- No production source changed; public-path card tests close all ten gaps.
- Fresh official authority is 2257 printings; the tracked snapshot remains 2256
  because new PR322 stays outside this adjudication. Q&A remains 2964/zero conflict.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves140-141 session record.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are mostly
  singleton or pairs and are not implementation-wave boundaries.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- The next routine full checkpoint remains Waves144-145 unless T3/publication
  requires earlier.
- Certification-only work uses no review agent. Raise route on a production
  defect, rule conflict, or new engine path.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves140-141.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave142: complete B10099

- Certify all five remaining B10099 Q&A items in one card matrix.
- Current suffix prefixes: `640df767ce16`, `778f2ec6d361`, `da2cc774eb1e`,
  `dc46dc53a352`, `f3a731df3e17`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave143: complete B01009

- Certify all four remaining B01009 Q&A items in one card matrix.
- Current suffix prefixes: `2ca5b478df68`, `9b35da4fb6ed`, `eee7f80e75bd`,
  `f9d4fa8587cf`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Waves140-141 focused horizontal gate: 7 files / 75 tests PASS. Both TypeScript
  projects and scoped ESLint PASS; QA merge/lint PASS.
- Latest full functional Vitest: 1213 files / 12752 tests PASS / 177 skip; two
  protected release-writer lanes excluded. Full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Latest Sol rules and engine reviewers PASS. Next routine full gate 144-145.

## Estimate

- Snapshot: 1142 remaining items / 1012 exact groups; 882 singleton groups.
- Remaining QA work: 64-128 working hours; center about 96 hours.
- Risk-aware batching forecast: roughly 48-88 implementation waves.
