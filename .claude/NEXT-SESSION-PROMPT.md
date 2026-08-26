# Next Task: card-completion QA Waves180-181

Resume `qa/adjudication-wave-20260814-13` after the Waves178-179 commit.

## Completed

- Waves178-179 align sixteen B08032-B08047 rows. Coverage is 2072 matched /
  892 test-missing / 2964 total; 786 exact groups remain, 680 singletons.
- BUG-379 fixes B08034/B08034P at the after-sleep, pre-Mislead/evidence window.
- Rules adjudication corrected the stale incoming hash descriptions before merge.
- Full functional Vitest, TypeScript, full ESLint, smoke1000/baseline, focused
  public tests, QA merge, and horizontal scan are green.

## Cadence

- Per wave: fresh authority, public proof, narrow QA merge.
- Per two waves: type/focused lint/QA/docs/diff, one commit, one push.
- Broad gates every ten waves or immediately after T2/T3/security/save/UI.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch/upstream/status and preserve the two untracked pnpm files.
3. Re-run hash-only queue and isolated authority hashes.
4. Handle B08054 as an isolated T3 RED/design/review before aligning its row.
5. Re-evaluate CardDefs and stale DEFER notes; use public dispatch proof.

## Wave180: nine items

- `B08048 3053f6462e12...`: level7 becomes level6, then qualifies for AP+3000.
- `B08048 723965466bac...`: action trigger resolves after sleep and before guard.
- `B08048 7744747aea8b...`: later FBI entry does not retroactively grant Assault.
- `B08051 2f338c8af1f1...`: declaration cost cannot use opponent remove cards.
- `B08051 43e0680a7f73...`: switch removes Akemi before entry-condition evaluation.
- `B08051 c77e68990a51...`: later Akemi removal does not retroactively grant Assault.
- `B08051 f4a642b51d9e...`: granted Assault persists after Akemi leaves remove.
- `B08054 94adce46750f...`: T3 BLOCK — opponent leave replacement returns all
  face-down set cards to hand immediately before same-time effects.
- `B08055 e4a36acb6bbb...`: opponent-turn Cut-In is usable, but inactive text adds
  no extra hand removal or AP.

## Wave181: seven items

- `B08057 291f87522e20...`: exact top-nine cost uses only the owner deck.
- `B08057 fa43ed745439...`: cards just paid into remove are eligible for the tail.
- `B08059 24724a7bdd74...`: started Assault action survives later condition loss.
- `B08059 9a421079649c...`: self-adjusted level7 counts in its own aura latch.
- `B08060 1e6decec598c...`: post-search scene entry remains zero-selectable.
- `B08060 facf6c955657...`: first revealed level7 must enter hand; no decline.
- `B08062 b097293b6a62...`: continuous aura has no activation/decline window.

## Carry-forward

- Authority: 2257 printings / 2964 Q&A / conflict zero; normalized hash
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- Dossiers: `C:/Users/arumi/AppData/Local/Temp/conan-ground-wave180-181-20260826`.
- CT-P08 hashes: event `0355d32c6952...`, character `ae38933ccbeb...`,
  case `f152683d7038...`, partner `6acb5b4707e3...`.
- B08059 and B08057 DEFER rows are stale; B08054 is a genuine missing capability.
- Preserve `pnpm-lock.yaml` and `pnpm-workspace.yaml`; keep official sync drift separate.
- About 87 waves remain through roughly Wave266.
