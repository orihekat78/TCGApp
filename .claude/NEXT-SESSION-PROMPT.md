# Next Task: QA adjudication Wave42

Resume from `qa/adjudication-wave-20260814-13` after the Waves40-41 commit.

## Completed

- Waves40-41 assisted FILE action/declared certification is complete.
- Coverage is 1260 matched and 1704 test-missing.
- Eleven cards prove public assist-derived FILE thresholds through real
  action-declare, action-end, and declared ability paths.
- Below-threshold and sufficient-opponent controls remain inactive.
- No production implementation changed.

## Fresh evidence

- Focused horizontal: 15 files / 126 tests pass.
- Final full-suite, smoke, lint, docs, QA baseline, and representative E2E
  evidence are recorded in `.claude/sessions/2026-08-23-qa-waves40-41.md`.

## Start Wave42

1. Confirm branch, HEAD, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they predate
   Wave40 and are intentionally not committed.
3. Continue the generic FILE(X) group with
   `questionHash=83f99d7f849a53ff4c5752670be0fe2c1c997c9445cee2ac6280302a6941d8cc`
   and `answerHash=9a850b0aa69167d50fe9b35374145bd3a1f7c6ca2159ee4d9315b205401b53c5`.
4. Fourteen records remain in this group. Start with nine implemented declared
   abilities: B07069, B08004, B08007, B09055, B09060, PR179, PR185, PR199, PR205.
5. Ground each threshold and cost. Use public assist from threshold-minus-two
   and threshold-minus-one, then public declared dispatch and real continuation.
6. Verify any FILE-pop/removal skips the assisted partner and every rejected
   declaration leaves costs, limits, zones, and pending decisions unchanged.
7. Do not certify B07093 through a2/a3; printed FILE7 a1 remains deferred.
8. The later non-declared remainder is B06087/PR280 plus PR100/PR106.
9. Apply T3 gates only if behavior changes; otherwise use T1 batch gates and
   one semantic review. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves40-41.md`
- `.claude/changelog-entries/2026-08-23-06-qa-wave40-file-assist-action.md`
- `.claude/changelog-entries/2026-08-23-07-qa-wave41-file-assist-declared.md`

`check:wave-scope` is a YOU-vs-CPU hardening-manifest check and is not a
Wave42 gate. Release clean-worktree tests also remain inapplicable while the
two protected pre-existing pnpm files stay untracked.
