# Next Task: card-completion QA Waves144-145

Resume `qa/adjudication-wave-20260814-13` after the Waves142-143 commit.

## Completed

- Wave142 finishes all five remaining B10099/P Q&A items.
- Wave143 finishes all four remaining B01009/P Q&A items.
- Coverage is 1831 matched / 1133 test-missing / 2964 total.
- No production source changed; public-path card tests close all nine gaps.
- Fresh official authority is 2257 printings; the tracked snapshot remains 2256
  because new PR322 stays outside this adjudication. Q&A remains 2964/zero conflict.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves142-143 session record.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are mostly
  singleton or pairs and are not implementation-wave boundaries.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- Waves144-145 are the routine ten-wave full checkpoint. Run full functional
  Vitest, full ESLint, smoke/baseline, and isolated desktop/mobile Playwright.
- Certification-only work uses no review agent. Raise route on a production
  defect, rule conflict, or new engine path.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves142-143.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave144: complete B01045

- Certify all four remaining B01045 Q&A items in one card matrix.
- Current suffix prefixes: `05863fa35054`, `67e481015241`, `858dc0993195`,
  `ef2f7279fad2`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave145: complete B02030

- Certify all four remaining B02030 Q&A items in one card matrix.
- Current suffix prefixes: `22477398ef5d`, `39a9ed43f18`, `aa20aec7b73c`,
  `d2129671c0cc`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Waves142-143 focused horizontal gate: 8 files / 72 tests PASS. Both TypeScript
  projects and scoped ESLint PASS; QA merge/lint PASS.
- Latest full functional Vitest: 1213 files / 12752 tests PASS / 177 skip; two
  protected release-writer lanes excluded. Full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Latest Sol rules and engine reviewers PASS. Refresh every full-gate result in
  this checkpoint; do not carry the Waves138-139 full evidence forward again.

## Estimate

- Snapshot: 1133 remaining items / 1004 exact groups; 875 singleton groups.
- Remaining QA work: 63-127 working hours; center about 95 hours.
- Risk-aware batching forecast: roughly 47-87 implementation waves.
