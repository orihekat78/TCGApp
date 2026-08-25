# Next Task: card-completion QA Waves168-169

Resume `qa/adjudication-wave-20260814-13` after the Waves166-167 commit.

## Completed

- Waves166-167 align eighteen CT-P07 items. Coverage is 1965 matched / 999
  test-missing / 2964 total; about 884 exact groups remain, including 769
  singletons.
- BUG-371 restores B07033/P/P2 FILE6 Disguise without shifting old indices.
- BUG-372 preserves detached `setcard:leave` authority across batch removal.
- BUG-373 restricts B07034/P to face-down set-card leaves.
- Full Vitest, TypeScript, ESLint, smoke 1000, QA merge/lint, Sol engine review,
  and targeted desktop/mobile Playwright pass. Full Playwright had one unrelated
  B08054 mobile bootstrap timeout; an immediate isolated rerun passed 1/1.

## Cadence

- Per wave: fresh authority, public proof, narrow QA merge.
- Per two waves: type/focused lint/QA/docs/diff, one commit, one push.
- Broad Vitest/Playwright/smoke runs only every ten waves or immediately after
  T3/security/save/public-UI changes. Certification-only work uses no agents;
  T3 uses no more than three read-only judges.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch, upstream, status, and protected pnpm files read-only.
3. Re-run the hash-only queue and fresh isolated authority validation.
4. Regenerate grounding dossiers for every selected physical printing.

## Wave168: nine items

- `B07043 2936447fd71a...`: a declared atomic name matches a multi-name card.
- `B07043 ccc7d4dcc95c...`: no match means return all revealed cards and shuffle.
- `B07043 e6c826386ff0...`: the first matching reveal must enter hand.
- `B07044 5f731874760d...`: all other own Magicians receive the continuous aura.
- `B07046 c758369a7ddd...`: own Big Jewels continuously scale AP only while active.
- `B07047 dcf72f7ad683...`: Red Magic case-gated Assault is inactive otherwise.
- `B07048 b28b7e81f684...`: declared set-card cost may use only own cards.
- `B07050 c680d5aa9a17...`: Cut-In checks the current contact character, not target.
- `B07051 81ca9d0c5d23...`: reveal the last deck card before any refresh.

## Wave169: nine items

- `B07052 6f98c3d7a03f...`: no Red Magic event returns all reveals, then shuffles.
- `B07052 789049b9d288...`: the first matching event must enter hand.
- `B07053 036ecf3e2ce9...`: granted Kid name applies only while in the scene.
- `B07053 7ce0d31df5ea...`: printed Robot name remains alongside granted Kid name.
- `B07053 ae3ba03b8b92...`: revealed hand card may be hidden after resolution.
- `B07055 3bbd1d1b862d...`: the optional AP8000 removal may be skipped independently.
- `B07055 dcf72f7ad683...`: Red Magic case gate controls event availability.
- `B07055 f132117a4178...`: two set cards may come from two separate own hosts.
- `B07056 114d0e7421b2...`: a stunned Koizumi Akako cannot pay the sleep requirement.

## Carry-forward

- Snapshot: 2257 printings / 2964 Q&A / conflict zero; normalized hash
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P07 character SHA:
  `d53cafbfcc4415940f6e8879c1cc51633b1644924b0492fdb25484d11c7e3019`.
- Fresh dossiers: `%LOCALAPPDATA%/Temp/conan-ground-wave168-169`.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- At nine exact groups per wave, current queue is about 99 waves (through
  approximately Wave266); recalculate after every two-wave batch.
