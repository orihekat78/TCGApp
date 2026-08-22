# Next Task: QA adjudication Wave36

Resume from `qa/adjudication-wave-20260814-13` after the Wave35 commit.

## Completed

- Wave35 physical ability occurrence identity is complete.
- Coverage is 1227 matched and 1737 test-missing.
- BUG-329 old-save and malformed-count compatibility is fixed.
- B01057/P, B05117/P, B07014/P, and B10017/P retain exact source identity
  through engine, AI, replay, JSON, payment, public UI, and turn limits.
- Sol engine, Sol adversarial, and Terra horizontal reviews return PASS.

## Fresh evidence

- Focused final: 4 files / 113 tests pass.
- Full serialized functional Vitest: 1114 files / 10737 tests pass;
  3 files / 177 tests skip.
- Typecheck, ESLint, docs check, QA merge/lint, smoke 1000, and baseline pass.
- Wave35 Playwright desktop/mobile passes. Every full-suite failure was
  repaired and its affected specs rerun green; one mobile contact failure was
  non-reproducible on isolated rerun.

## Start Wave36

1. Confirm branch, HEAD, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they predate
   Wave35 completion and are intentionally not committed.
3. Run `npm run qa:adjudication:queue` and select one coherent official-QA
   cluster from the remaining 1737 test-missing records.
4. Use public RED probes, update adjudication evidence, run T3 gates when the
   cluster touches engine state, and stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-wave35.md`
- `.claude/bugs/BUG-329.md`
- `.claude/changelog-entries/2026-08-23-01-qa-wave35-ability-occurrences.md`

`check:wave-scope` is a YOU-vs-CPU hardening-manifest check and is not a
Wave35/36 gate. Release clean-worktree tests also remain inapplicable while the
two protected pre-existing pnpm files stay untracked.
