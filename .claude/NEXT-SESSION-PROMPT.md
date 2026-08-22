# Next Task: QA adjudication Wave44

Resume from `qa/adjudication-wave-20260814-13` after the Waves42-43 commit.

## Completed

- Waves42-43 certify thirteen assisted-FILE rulings.
- Coverage is 1273 matched and 1691 test-missing.
- Forty of 41 exact FILE(X) Q&A records are matched.
- All shipped FILE declarations, contact-removal observers, and cut-ins now have
  public assist below/exact coverage plus secondary-gate controls.
- No production implementation changed.

## Fresh evidence

- Focused horizontal: 15 files / 191 tests pass.
- Final full-suite, smoke, lint, docs, QA baseline, and representative E2E
  evidence are recorded in `.claude/sessions/2026-08-23-qa-waves42-43.md`.

## Start Wave44

1. Confirm branch, HEAD, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they predate
   Wave42 and are intentionally not committed.
3. Implement B07093/B07093P printed a1. Existing engine primitives are sufficient.
4. Preserve existing physical occurrence indices: current arrays are `[a2,a3]`.
   Append a1 as index2 (`[a2,a3,a1]`) unless a full migration is deliberately designed.
5. a1: black partner + FILE7 + turn1, top-level choice of hand/remove source,
   level4-or-lower Black Organization entry, AP+4000, Assault, and
   `toDeckBottomOnTurnEnd` rider.
6. Use D09020/PR181/B07079 as structural exemplars. Keep branch-local binding;
   do not wrap the top-level choice in an outer sequence.
7. Public regressions must cover both sources, FILE6/7 with assist, wrong partner,
   zero choice, decoys, turn1, enter trigger, full-scene switch, disguise
   inheritance, exact deck bottom, early leave, and B/P parity.
8. Then Wave45 candidate is the 12-card Bond ruling group:
   question `d8ced3f4222d9630568eede1e9416005ead16a8878608c6d49929fef8fee803f`,
   answer `8185415da360caa339eec528c2e80b68ea2888896d0c51e0ecbc38b4ab7ec288`.
9. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves42-43.md`
- `.claude/changelog-entries/2026-08-23-08-qa-wave42-file-assist-declared-remainder.md`
- `.claude/changelog-entries/2026-08-23-09-qa-wave43-file-assist-nondeclared.md`

`check:wave-scope` is a YOU-vs-CPU hardening-manifest check and is not a
Wave44 gate. Release clean-worktree tests also remain inapplicable while the
two protected pre-existing pnpm files stay untracked.
