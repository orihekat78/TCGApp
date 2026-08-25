# Next Task: card-completion QA Waves146-147

Resume `qa/adjudication-wave-20260814-13` after the Waves144-145 commit.

## Completed

- Wave144 finishes all four remaining B01045 Q&A items.
- Wave145 finishes all four remaining B02030 Q&A items.
- Coverage is 1839 matched / 1125 test-missing / 2964 total.
- BUG-365 implements immediate Cut-In negation with human/CPU parity, exact-two
  physical set-card removal, cold restore, causal presentation, and action-order preservation.
- Fresh official authority is 2257 printings; the tracked snapshot remains 2256
  because new PR322 stays outside this adjudication. Q&A remains 2964/zero conflict.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves144-145 session record.

## Throughput contract

- Prefer complete-card batches of 5-15 grounded items; exact groups are mostly
  singleton or pairs and are not implementation-wave boundaries.
- Keep unrelated semantics in separate describe blocks inside one card matrix.
- Per wave: focused behavioral tests and narrow QA merge only.
- Two-wave checkpoint: typechecks, focused ESLint, QA trace/lint, docs,
  diff-check, one commit, and one push.
- The next routine full checkpoint is Waves154-155 unless T3/publication requires
  earlier. Ordinary certification waves use focused gates only.
- Certification-only work uses no review agent. Raise route on a production
  defect, rule conflict, or new engine path.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-25-qa-waves144-145.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave146: complete B02058

- Certify all four remaining B02058 Q&A items in one card matrix.
- Current suffix prefixes: `762a82ad66fe`, `9ff7004a9839`, `a8bf8ce39b8a`,
  `ff6d7da4ad97`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave147: complete B02067

- Certify all four remaining B02067 Q&A items in one card matrix.
- Current suffix prefixes: `21d33c0a5eb6`, `902ae020bffe`, `b822c6a98356`,
  `fdda495dd5c8`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Full functional Vitest: 1219 files / 12831 tests PASS / 177 skip; two protected
  release-writer lanes excluded. Both TypeScript projects and full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0, average11.685.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Sol rules and engine reviewers PASS; Critical/Important zero.

## Estimate

- Snapshot: 1125 remaining items / 997 exact groups; 869 singleton groups.
- Remaining QA work: 62-126 working hours; center about 94 hours.
- Risk-aware batching forecast: roughly 46-86 implementation waves.
