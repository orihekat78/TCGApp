# Next Task: card-completion QA Waves188-189

Resume `qa/adjudication-wave-20260814-13` after the Waves186-187 commit.

## Completed

- Waves186-187 align sixteen B08092-B09005 rows. Coverage is 2140 matched /
  824 test-missing / 2964 total; 722 exact groups remain, 620 singletons.
- BUG-381 adds exact reveal-cost hand selection/public presentation. BUG-382
  preserves current-effect-first for hand-reveal reactions and rollback safety.
- Sol rules and engine final reviews: blocker 0. Playwright full 477 plus the
  exact reveal-cost desktop/mobile probe 2/2 pass.

## Cadence

- Continue without confirmation. Accuracy remains first.
- Per two waves: focused/type/lint/QA/docs, one commit, one push.
- Broad gates every ten waves or immediately after T2/T3/security/save/UI.
- Reuse at most three read-only agents. Stop after two implementation waves or
  around 60% context and write the next handoff.

## Start

1. Read root/cards/tests/.claude AGENTS and router/card-wave/verify skills.
2. Verify branch/upstream/status and preserve the two untracked pnpm files.
3. Re-run hash-only queue and isolate the selected subset from local raw drift.
4. Ground every row below before trusting its current test-gap description.
5. Re-evaluate CardDefs and stale DEFER notes; use public owner mirrors.

## Wave188 candidates: eight rows

- `B09006 2d9f6416a9ef...`
- `B09008 de2d797a1d00...`
- `B09009 5f731874760d...`
- `B09010 0934ecf9bcc2...`
- `B09011 1326a9294ee6...`
- `B09011 8c5daccdad59...`
- `B09014 4ad5af7ab24f...`
- `B09015 f9e96c0a30ab...`

## Wave189 candidates: eight rows

- `B09016 8d2d79973300...`
- `B09017 d95b8a90fc8a...`
- `B09021 a113c965536a...`
- `B09022 b17d52d4d400...`
- `B09023 a649379465a8...`
- `B09024 2f27486500c3...`
- `B09024 85898367b278...`
- `B09024 88708bfce2f1...`

## Carry-forward

- Authority: 2257 printings / 2964 Q&A / tracked normalized hash
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- Wave188 is mostly established primitives; B09010 has multi-entry/FILE timing.
- Wave189 is T3-sensitive around B09016 misread, B09017 Cut-In restriction,
  B09022/B09023 contact attribution, and B09024 granted-trigger aura.
- Release-only dirty-worktree and pnpm-junction `jose` gates remain isolated;
  do not relax the private-hosted security allowlist.
- Preserve `pnpm-lock.yaml` and `pnpm-workspace.yaml`; keep official sync drift separate.
- About 80 waves remain through roughly Wave267.
