# Next Task: QA adjudication Waves60-61

Resume `qa/adjudication-wave-20260814-13` after the Waves58-59 commit.

## Completed

- Wave58 certifies seven owner-hand cost records across ten physical sources.
- Wave59 certifies seven owner deck-top-three cost records across eleven
  physical sources, including exact-three refresh and compound atomicity.
- Coverage should be 1400 matched / 1564 test-missing after generation.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Wave60: stun definition

1. Confirm branch, HEAD, upstream, and protected files read-only.
2. Ground exact Q/A
   `7a6f08e207e70382e9b77aaff63586b84027d225047cd889e2427c5b5056298e`
   / `4a353f4020ed75a813e684394164883e125362ef4b05b00a05fbf73e18662941`:
   a stunned character is upside down after receiving a stun effect.
3. Certify B02057, B02083, D02004, D02013, PR060, PR064, PR154.
4. Bind every physical source and prove active/sleep/stun transitions, repeated
   stun/sleep no-op, activation-to-sleep replacement, and action prohibition.

## Wave61: full-scene effect entry and switch

1. Ground exact Q/A
   `c2d241b8e2cb10d82b2dc238b1317d1d722a4749ff9ee0585d7c9d15026aba42`
   / `0e19d91c02200449417a55074745e64a3393a543782d6647d6b042fbd8f0201e`:
   effect entry is legal at five scene characters by switching one out; the
   newly entered character itself may be the switched-out character.
2. Certify B04046, B05007, B05090, B06090, B09038, B10005, B10023.
3. Use every physical source, full-scene chooser authority, self-switch of the
   entrant, typed decoys, leave/enter hook ordering, decline, and owner symmetry.
4. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves58-59.md`
- `.tmp/_ground/wave58/` and `.tmp/_ground/wave59/`

Remaining estimate: about 1,564 records, roughly 133-287 agent hours. Route
grouping and horizontal fixes may reduce it.
