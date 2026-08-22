# Next Task: QA adjudication Wave38

Resume from `qa/adjudication-wave-20260814-13` after the Waves36-37 commit.

## Completed

- Waves36-37 self-only evidence-cost certification is complete.
- Coverage is 1239 matched and 1725 test-missing.
- Twelve case abilities prove through public dispatch that declared costs cannot
  use opponent evidence and must flip exactly two self evidence cards.
- Rejected incident, insufficient, overpayment, and repeat attempts preserve
  evidence, printed ability count, and pending decisions transactionally.
- Independent test review returns PASS after its asymmetric-fixture BLOCK was fixed.

## Fresh evidence

- Focused horizontal: 12 files / 79 tests pass.
- Full functional Vitest: 1116 files / 10750 tests pass;
  3 files / 177 tests skip.
- Typecheck, ESLint, docs check, QA merge/lint, smoke 1000, and baseline pass.
- Representative evidence-picker Playwright passes desktop/mobile 4/4.

## Start Wave38

1. Confirm branch, HEAD, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they predate
   Wave36 and are intentionally not committed.
3. Inspect the exact FILE(8) group with
   `questionHash=83f99d7f849a53ff4c5752670be0fe2c1c997c9445cee2ac6280302a6941d8cc`
   and `answerHash=9a850b0aa69167d50fe9b35374145bd3a1f7c6ca2159ee4d9315b205401b53c5`.
4. The normalized ruling is: 「FILE(8)は【アシスト】したパートナーも
   数えますか?」→「はい、数えます。」 The exact group has 35 cards.
5. Select a mechanically coherent bounded subgroup only after mapping each
   card's FILE gate and public assist/action route; do not group by answer hash alone.
6. Use asymmetric public RED probes for count 7 + assisting partner versus
   count 6 + partner, update evidence, and apply T3 gates if engine state changes.
7. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves36-37.md`
- `.claude/changelog-entries/2026-08-23-02-qa-wave36-self-only-evidence.md`
- `.claude/changelog-entries/2026-08-23-03-qa-wave37-self-only-evidence.md`

`check:wave-scope` is a YOU-vs-CPU hardening-manifest check and is not a
Wave38 gate. Release clean-worktree tests also remain inapplicable while the
two protected pre-existing pnpm files stay untracked.
