# Next Task: card-completion QA Waves148-149

Resume `qa/adjudication-wave-20260814-13` after the Waves146-147 commit.

## Completed

- Wave146 finishes all four remaining B02058 Q&A items.
- Wave147 finishes all four remaining B02067 Q&A items.
- Coverage is 1847 matched / 1117 test-missing / 2964 total.
- BUG-366 distinguishes B02039 set-card proxy selection from host-character
  selection through authenticated human/autonomous resolution.
- Fresh official authority is 2257 printings; the tracked snapshot remains 2256
  because new PR322 stays outside this adjudication. Q&A remains 2964/zero conflict.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves146-147 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves146-147.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave148: complete B02088

- Certify all four remaining B02088 Q&A items in one card matrix.
- Current suffix prefixes: `4960b9069762`, `93cc0cd820f4`, `a0c7e6e6f58d`,
  `e944414b8bab`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave149: complete B03094

- Certify all four remaining B03094 Q&A items in one card matrix.
- Current suffix prefixes: `3e54bbed10ce`, `5b6baf97ab8a`, `6701e39fe90f`,
  `9e084cf085f2`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Full functional Vitest: 1221 files / 12860 tests PASS / 177 skip; three files
  skipped and two protected release-writer lanes excluded. Both TypeScript projects
  and full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0, average11.685.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Sol rules and engine reviewers PASS; Critical/Important zero.

## Estimate

- Snapshot: 1117 remaining items / 989 exact groups; 861 singleton groups.
- Remaining QA work: 61-125 working hours; center about 93 hours.
- Risk-aware batching forecast: roughly 45-85 implementation waves.
