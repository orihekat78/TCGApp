# Next Task: card-completion QA Waves174-175

Resume `qa/adjudication-wave-20260814-13` after the Waves172-173 commit.

## Completed

- Waves172-173 align nineteen CT-P07 items. Coverage is 2021 matched / 943
  test-missing / 2964 total; 834 exact groups remain, including 725 singletons.
- B07085-B07098/P public matrices cover forced reveal, independent options,
  owner costs, turn-end timing, effective level, switch/contact, and refresh.
- Existing production behavior satisfies every ruling; no production gap exists.
- Wave suites 54/54, focused horizontal 465/465, TypeScript, scoped ESLint, and
  QA merge pass.

## Cadence

- Per wave: fresh authority, public proof, narrow QA merge.
- Per two waves: type/focused lint/QA/docs/diff, one commit, one push.
- Broad Vitest/Playwright/smoke only every ten waves or immediately after
  T3/security/save/public-UI changes. Certification-only work uses no agents;
  T3 uses no more than three read-only judges.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch, upstream, status, and protected pnpm files read-only.
3. Re-run the hash-only queue and fresh isolated authority validation.
4. Regenerate grounding for every physical printing.
5. Re-evaluate stale/mixed DEFER notes for B07100, B07104, B08002, B08003,
   and B08004 against current production. Escalate only confirmed gaps.

## Wave174: eleven items

- `B07100 8fa59c53057e...`: dynamically granted hand Cut-In remains eligible.
- `B07100 9ea8c56b58d1...`: an inactive conditional Cut-In remains eligible.
- `B07103 b385cc0ffa2c...`: sole-card draw refreshes before mandatory discard.
- `B07103 e7696529447c...`: level -1 affects later level references only.
- `B07104 8bbd69cb6407...`: short mill stops after remainder and one refresh.
- `B08002 38d6b9712427...`: effect mill may exceed deck; remainder then refresh.
- `B08002 84d5143b0987...`: mill count uses effective level at removal.
- `B08003 78b5e21ca117...`: 結成 少年探偵団 is a legal distinct-name stack pick.
- `B08003 893ecd7cc4f7...`: its entry may stack the just-switched-out character.
- `B08003 43b1bf5d83d7...`: effect entry at cap switches immediately; tail continues.
- `B08003 a96985ed96d0...`: entrant enter ability resolves after the parent tail.

## Wave175: eight items

- `B08004 1a671f169920...`: the stun cost accepts only an own active Ai.
- `B08009 5bc4c2fb8ed9...`: exact deck-top-two cost rejects a one-card deck.
- `B08009 6b40bc9cc445...`: deck-top cost uses only the owner's deck.
- `B08010 38eccfde6956...`: character action continues after Bond Assault expires.
- `B08012 607ba7d26dee...`: case action continues after Bond Assault expires.
- `B08014 2a32c78cf7b6...`: MR selection has the printed own-MR effect scope.
- `B08014 90bfc974760d...`: pre-action MR selection also prevents turn-end return.
- `B08016 07fa73b6ca16...`: leave source joins refresh during its draw-two effect.

## Carry-forward

- Snapshot: 2257 printings / 2964 Q&A / conflict zero; normalized hash
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- Fresh dossiers: `C:/Users/arumi/AppData/Local/Temp/conan-ground-wave174-175-7565a84ece9f`.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- About 93 waves remain through roughly Wave266.
