# Next Task: QA adjudication Waves58-59

Resume `qa/adjudication-wave-20260814-13` after the Waves56-57 commit.

## Completed

- Wave56 certifies eight physical disguise-definition records.
- BUG-337 rejects a second action in the same contact acted slot.
- Wave57 certifies eight arbitrary-position exact-two evidence records across
  fifteen physical case printings.
- Coverage should be 1386 matched / 1578 test-missing after generation.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Wave58: self-only hand removal cost

1. Confirm branch, HEAD, upstream, and protected files read-only.
2. Ground exact Q/A
   `03c52f9b3040dd01736be520bb4a0434249fef8211fc98946341ee7cac05c5b1`
   / `45979cb61275514a31c0e89b0df5a48215e8c3e34e6e49457a0a2c82fd481c80`:
   a declared cost saying remove one hand card may use only the owner's card.
3. Certify B07020, B07032, B07063, B07074, B07088, D10007, D10008.
4. Use each physical source, an opponent-hand sentinel, exact one-card payment,
   insufficient/overspecified/forged payment rejects, turn-use accounting, and
   card-specific post-cost effects.

## Wave59: self-only deck-top-three removal

1. Ground exact Q/A
   `d6e909a14c1e94acb86b7c9eee2242041ca16d02d8ea88f3f1dba04866d0237e`
   / `45979cb61275514a31c0e89b0df5a48215e8c3e34e6e49457a0a2c82fd481c80`:
   a declared cost removing the deck's top three cards cannot use the opponent's deck.
2. Certify B04077, B06020, B07001, B08025, B10089, PR292, PR298.
3. Prove exact own top-three occurrence/order, short-deck rejection,
   opponent-deck isolation, atomic failure, and each printed post-cost effect.
4. Stop after one or two implementation waves.

## Records

- `.claude/sessions/2026-08-23-qa-waves56-57.md`
- `.claude/bugs/BUG-337.md`
- `.tmp/_ground/wave56/` and `.tmp/_ground/wave57/`

Remaining estimate: about 1,578 records, roughly 134-290 agent hours. Route
grouping and horizontal fixes may reduce it.
