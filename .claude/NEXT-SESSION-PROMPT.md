# Next Task: QA adjudication Waves80-81

Resume `qa/adjudication-wave-20260814-13` after the Waves78-79 commit.

## Completed

- Wave78 certifies four set-event target records across seven physicals.
- Wave79 certifies B01065, B01069, and B02061 across four physicals.
- BUG-344 fixes B02061's missing optional and zero-card evidence transfer.
- Coverage is 1508 matched / 1456 test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves78-79.md` and current QA trace.
4. Fetch needed CT-P02/CT-P03 authority only into a separate `.tmp` root.

## Wave80

- Exact tuple: Q `f4bbd03d5c63d2445b8f5de8897299d3b4d82e8686ba1e049b82f77724d632c9`,
  A `471dbd81e897e564c03b9dec6f7c79c7d383055b3da168f9c89e5348f224708a`,
  section `0029d75498ecdbd0f5ec8a773acb521b538c42cfb00ee15631b9b02d68462f09`.
- QA suffix `768a20fc5e6e165184d999a8032847d4633ef46d0ac9edd814f3c4ebb18e8e72`.
- Targets: B02038/P, B02044/P, B02086/P. Matched control: B02041/P.
- Ground the exact shared ruling before defining the matrix. Keep enter and
  disguise hooks distinct while covering each card's rider: remove-area entry,
  deck-look/order, opponent discard/contact immunity, and turn grants.
- Prove public valid/decoy/zero decisions, owner orientation, CPU, expiry, and
  save hydration where a decision persists.

## Wave81

- Exact tuple: Q `fec493c40578b4a964c5d174484e81328bae61e31d664655bb7940ef8016f130`,
  A `471dbd81e897e564c03b9dec6f7c79c7d383055b3da168f9c89e5348f224708a`,
  section `0029d75498ecdbd0f5ec8a773acb521b538c42cfb00ee15631b9b02d68462f09`.
- QA suffix `14a8ef526b9ef00574961cab066ef5e035dbbeb7f94728142ad18aaa7e3fc498`.
- Targets: B02043, B02045, B02047, B03050. No matched exact-tuple control.
- B02043 is a D06012 reprint. B02045 has a disguise AP rider, B02047 has
  replaced-character contact immunity, and B03050 has the Sera optional rider.
- Prove replaced-character valid/decoy boundaries, public accept/decline,
  opponent ownership, contact completion/expiry, CPU, and save where applicable.
- Do not merge Wave80 rows merely because their answer and section match;
  Wave80 and Wave81 have different question hashes.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves80-81 and write the next handoff.

Remaining estimate: 1456 records, about 123-268 agent-hours or 33-75 wall
hours with four-way parallel work before future grouping gains.
