# Next Task: QA adjudication Waves56-57

Resume `qa/adjudication-wave-20260814-13` after the Waves54-55 commit.

## Completed

- Wave54 certifies nine direct/linear effect-entry records.
- Wave55 certifies eight nested/physical-source effect-entry records.
- BUG-336 restores B09056/P real choice and condition-aware autonomous choice.
- Coverage should be 1370 matched / 1594 test-missing after generation.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Wave56: disguise definition

1. Confirm branch, HEAD, upstream, and protected files read-only.
2. Ground exact Q/A `a6d4bbd6170b.../5a5d483a0490...`:
   【変装】 is a contact action sharing cut-in timing; hand disguise swaps with
   the contacting character, sends the original to deck bottom, and inherits
   state, gained effects, and set cards.
3. Certify B02041, B02043, B02044, B02045, B02047, B02086, B05047, B06017.
4. Reuse generic disguise lifecycle only with card-bound physical source and
   state/effect/set-card inheritance assertions.

## Wave57: arbitrary evidence positions

1. Ground exact Q/A `24edb9585cfc.../cfea53ad6b22...`: an exact-two evidence
   cost may choose any two face-down positions without changing evidence order.
2. Certify B07062, B08076, B08094, B10034, B10082, B10101, B10102, D10026.
3. Audit Wave36/37 `[down,up,down]` nonadjacent-index evidence before reuse.
4. Bind each physical case source and effect-specific success sentinel.
5. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves54-55.md`
- `.claude/bugs/BUG-336.md`
- `.tmp/_ground/wave54-55*/`

Remaining estimate: about 1,594 records, roughly 136-295 agent hours. Route
grouping and horizontal fixes may reduce it.
