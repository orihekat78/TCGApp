# Next Task: QA adjudication Wave40

Resume from `qa/adjudication-wave-20260814-13` after the Waves38-39 commit.

## Completed

- Waves38-39 assisted FILE counting certification is complete.
- Coverage is 1249 matched and 1715 test-missing.
- Ten cards prove through public `assist` that the partner counts toward their
  exact FILE(X) threshold; below-threshold and wrong-owner controls remain inactive.
- Continuous LP/AP and enter optional/pick/choice routes use real card behavior.
- No production implementation changed.

## Fresh evidence

- Focused horizontal: 12 files / 189 tests pass.
- Final full-suite, smoke, lint, docs, QA baseline, and representative E2E
  evidence are recorded in `.claude/sessions/2026-08-23-qa-waves38-39.md`.

## Start Wave40

1. Confirm branch, HEAD, and status without stash/reset/clean/checkout.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`; they predate
   Wave38 and are intentionally not committed.
3. Continue the generic FILE(X) group with
   `questionHash=83f99d7f849a53ff4c5752670be0fe2c1c997c9445cee2ac6280302a6941d8cc`
   and `answerHash=9a850b0aa69167d50fe9b35374145bd3a1f7c6ca2159ee4d9315b205401b53c5`.
4. The normalized ruling is generic: 「【FILE(X)】は【アシスト】した
   パートナーも数えますか?」→「はい、数えます。」 The full pair has
   41 QA; six were pre-matched, ten were added in Waves38-39, and 25 remain.
5. Start with the public action-lifecycle cluster:
   B04068, B05108, D09016, D09017, PR289, PR295.
6. Ground each printed threshold. Dispatch assist from threshold-minus-two and
   threshold-minus-one, then complete the real public action flow. Keep
   `action:declare` and `action:end` observations distinct.
7. Do not certify B07093 through a2/a3. Its printed FILE7 a1 remains deferred.
8. Apply T3 gates only if behavior changes; otherwise use T1 batch gates and
   one semantic review. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves38-39.md`
- `.claude/changelog-entries/2026-08-23-04-qa-wave38-file-assist-continuous.md`
- `.claude/changelog-entries/2026-08-23-05-qa-wave39-file-assist-enter.md`

`check:wave-scope` is a YOU-vs-CPU hardening-manifest check and is not a
Wave40 gate. Release clean-worktree tests also remain inapplicable while the
two protected pre-existing pnpm files stay untracked.
