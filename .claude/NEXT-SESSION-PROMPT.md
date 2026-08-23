# Next Task: QA adjudication Wave48 selection

Resume `qa/adjudication-wave-20260814-13` after the Waves46-47 commit.

## Completed

- Wave46 certifies twelve end-phase reactivation Q&As.
- BUG-330 gates reasoning, action, hand use, next hint, declared ability, and
  partner ability to the acting player's main phase.
- Wave47 certifies eight Investigation/found-card Q&As.
- BUG-331 publishes Souza cards and centrally marks 140 bottom operations;
  no false whole-deck shuffle.
- Coverage is 1310 matched and 1654 test-missing.

## Fresh evidence

- Focused horizontal: 20 files / 402 tests pass.
- Exact semantic/rules review passes; generated QA drift is resolved in the
  Waves46-47 session record.
- Full gates and review evidence: `.claude/sessions/2026-08-23-qa-waves46-47.md`.

## Start Wave48

1. Confirm branch, HEAD, upstream, and status read-only.
2. Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
3. Regenerate current remaining-group counts before selecting.
4. Route-screen these candidates; do not certify a mixed hash group wholesale:
   - 12 records: question `0275802774c03a262fe083619baff76576ca5c5981aa03151838a4b4df39f7a9`,
     answer `83d521329e90458d525fb8ebb53e11d58a4adcf35d2cbf475988a0080b4a6e27`.
   - 10 records: question `96d539095bb0b8be1cf2336f9ee65a3459fc6ea4ab69f54e8227bbfe312eeb2b`,
     answer `47d3f424c54fdda218fd6120058f5d1cd53286fb892b7f7225bac77745c6b456`.
   - 9 records: question `5a4907ebfe4c2f9ed9b35d72bab15716764a6b60c218d1d7ba23cdb9e6b5bc51`,
     answer `89083b38d6aba9556fbac3cdddc4f03f3ffe48270972799cfc0fa0f523c39934`.
5. Prefer the first candidate only if exact-text grounding proves one coherent
   public route and does not duplicate Waves38-43 FILE/assist certification.
6. Split any action-lifecycle or deck-reveal subgroup before implementation.
7. Use public dispatch, condition-breaking decoys, exact QA assertions, and
   card-bound adjudication evidence.
8. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves46-47.md`
- `.claude/changelog-entries/2026-08-23-12-qa-wave46-end-phase-main-boundary.md`
- `.claude/changelog-entries/2026-08-23-13-qa-wave47-investigation-found.md`

Remaining estimate: 1654 records. Approximately 140-300 hours of uninterrupted
agent execution; regrouping equivalent routes may reduce it.
