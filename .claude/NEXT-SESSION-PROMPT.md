# Next Task: QA adjudication Waves76-77

Resume qa/adjudication-wave-20260814-13 after the Waves74-75 commit.

## Completed

- Waves74-75 certify three target records across four printings.
- No production change was required. Rules and adversarial reviews pass.
- Coverage is 1499 matched / 1465 test-missing / 2964 total.
- Existing untracked pnpm-lock.yaml and pnpm-workspace.yaml stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read .claude/sessions/2026-08-24-qa-waves74-75.md and current QA trace.
4. Fetch current CT-P06/PR01 authority only into a separate `.tmp`
   staging root. Never run `npm run cards:fetch` against live cards-data.

## Wave76

- Question hash:
  4c83ae18d65f1b03cdbede483062d4ba4c4eeb8fe8b183f0a8c1f9291a1d7e52
- Answer hash:
  d8cdbcf96cb81df73a04d13e77d97991d6dcaf5d6b1e012bc710edcd408f0a04
- Target record: B06067; physical sources B06067/P.
- Keep separate from Wave74 despite the same normalized Q/A: section and card
  contract differ.
- a2 draws once per turn when an opponent character is removed by contact with
  another own Police character; the source is excluded as the winning attacker.
- a3 pays one exact owner hand card, then may grant a Police character active-
  target action permission through turn.
- Prove contact cause/attacker/source exclusion, owner=`opp`, trigger cap, CPU,
  hand-cost atomicity, valid/decoy/zero targets, expiry, and save persistence.

## Wave77

- Question hash:
  3dda4dbea3bcb463b42f74d5a43c8d910a64c20cb6a648ae1dc790ced527d8ac
- Answer hash:
  b50f6e43eb70c18abd940ba85be3c89c7d6d230d8d92828f639fa7c11710fa32
- Candidate group: PR099 and PR105; group-equivalent eligible.
- Physical sources: PR099 and PR105.
- a1 sets deck top face-down on self-enter and grants Assault[character] through
  turn. a2 gives AP+1000 and may temporarily replace the full character name.
- Controls: B03061/B07034 for enter set, D09027/B01094/B05089 for Assault,
  and existing declared-name-domain tests.
- Prove deck-empty/set privacy, AP/keyword/name expiry, decline, registered-name
  validation, split-name replacement, public action legality, CPU, and save.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves76-77 and write the next handoff.

Remaining estimate: about 1,465 records, roughly 124-269 agent hours or 33-75
wall hours with four-way parallel work before future grouping gains.
