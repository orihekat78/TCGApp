# Next Task: QA adjudication Waves54-55

Resume `qa/adjudication-wave-20260814-13` after the Waves52-53 commit.

## Completed

- Wave52 repairs and certifies B06047, B08083, and B09007/P effect-entry paths.
- Wave53 certifies nine exact-two face-down evidence costs.
- Coverage should be 1353 matched / 1611 test-missing after generation.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Wave54: direct and linear effect entry

1. Confirm branch, HEAD, upstream, and protected files read-only.
2. Reuse exact Q/A `2aa7bfa6.../18ed0c93...`: a character entered by an
   ability/effect resolves its normal enter ability.
3. Certify B03062, B04090, B05015, B05077, B06012, B06046, B08076, B09106,
   and B10095.
4. Use real event/deck, contact/cut-in, Hirameki, end-phase/set, declared, and
   event-branch sources. Generic Wave31 evidence is not card-bound evidence.

## Wave55: nested, Bond, and clone entry

1. Certify B06087, B09056, B10023, D10023, PR173, PR280, PR291, and PR297.
2. For nested routes, distinguish outer and entered source card/uid.
3. For clones, execute each physical D10023/PR173 source; array equality with
   B02004 is insufficient.
4. Every route proves source dispatch, chosen entrant normal enter, ordering,
   owner/opponent asymmetry, typed decoys, and zero/decline behavior.
5. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves52-53.md`
- `.claude/bugs/BUG-335.md`
- `.tmp/_ground/wave52/`

Remaining estimate: about 1,611 records, roughly 138-298 agent hours. Route
grouping and horizontal fixes may reduce it.
