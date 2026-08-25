# Next Task: card-completion QA Waves150-151

Resume `qa/adjudication-wave-20260814-13` after the Waves148-149 commit.

## Completed

- Wave148 finishes all four remaining B02088 Q&A items.
- Wave149 finishes all four remaining B03094 Q&A items.
- Coverage is 1855 matched / 1109 test-missing / 2964 total.
- Production source is unchanged; public matrices close turn-end, Cut-In,
  Hirameki, action timing, exact-mill, repeat-action, and expiry gaps.
- Fresh official authority is 2257 printings; the tracked snapshot remains 2256
  because new PR322 stays outside this adjudication. Q&A remains 2964/zero conflict.
- Protected pnpm files and live cards-data remain untouched.
- Full evidence is in the Waves148-149 session record.

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
3. Read `.claude/sessions/2026-08-25-qa-waves148-149.md`, this prompt, and the
   current QA trace/workflow.
4. Re-run the hash-only queue and fresh isolated authority validation.
5. Run pinned grounding for every physical printing before adjudication.

## Wave150: complete B03102

- Certify all four remaining B03102 Q&A items in one card matrix.
- Current suffix prefixes: `0d310607ecb1`, `5bc3bbbf1d67`, `d9dae1726ce1`,
  `df53870dd5d1`.
- Ground every printing and separate exact Q&A semantics before test design.

## Wave151: complete B03112

- Certify all four remaining B03112 Q&A items in one card matrix.
- Current suffix prefixes: `2c83e0569954`, `671a506d6cd4`, `6d00eabe29a7`,
  `b1a3c7472a22`.
- Ground every printing and preserve owner, optional, and physical boundaries.

## Gate carry-forward

- Waves148-149 focused horizontal gate: 8 files / 154 tests PASS. Both
  TypeScript projects and scoped ESLint PASS; QA merge/lint PASS.
- Full functional Vitest: 1221 files / 12860 tests PASS / 177 skip; three files
  skipped and two protected release-writer lanes excluded. Both TypeScript projects
  and full ESLint PASS.
- Smoke1000 baseline PASS: 471/529, timeout0, exception0, average11.685.
- Full-match desktop/mobile Playwright: 2/2 PASS, console error0.
- Sol rules and engine reviewers PASS; Critical/Important zero.

## Estimate

- Snapshot: 1109 remaining items / 982 exact groups; 855 singleton groups.
- Remaining QA work: 60-124 working hours; center about 92 hours.
- Risk-aware batching forecast: roughly 44-84 implementation waves.
