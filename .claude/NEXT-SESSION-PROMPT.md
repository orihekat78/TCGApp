# Next Task: QA adjudication Waves74-75

Resume qa/adjudication-wave-20260814-13 after the Waves72-73 commit.

## Completed

- Waves72-73 certify twelve target records across nineteen printings.
- No production change was required. Rules and adversarial reviews pass.
- Coverage is 1496 matched / 1468 test-missing / 2964 total.
- Existing untracked pnpm-lock.yaml and pnpm-workspace.yaml stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read .claude/sessions/2026-08-24-qa-waves72-73.md and current QA trace.
4. Fetch current CT-P03/PR01 authority only into a separate `.tmp`
   staging root. Never run `npm run cards:fetch` against live cards-data.

## Wave74

- Question hash:
  4c83ae18d65f1b03cdbede483062d4ba4c4eeb8fe8b183f0a8c1f9291a1d7e52
- Answer hash:
  d8cdbcf96cb81df73a04d13e77d97991d6dcaf5d6b1e012bc710edcd408f0a04
- Candidate group: B03088 and B03095; group-equivalent eligible.
- Physical sources: B03088/P and B03095 (three).
- B03088: four-bond declared route; same selected level-7-or-lower character
  receives permanent AP, active state, turn Assault, then draw; zero is legal.
- B03095: opponent character-action trigger while sleeping; activate up to one
  own Police character, once per turn.
- Controls: B02005/B08023 for carrier order; B02026/B03097 for trigger gate.
- Prove boundaries, zero choices, state/expiry, owner orientation, CPU, and
  B03088 Hirameki decline through public decisions.

## Wave75

- Question hash:
  a039309215dc8edf69e1752ab6a1a73bfef80a85c8a1d4598bb4e3e2a99d4a11
- Answer hash:
  75e871a78c4bae0a61b3f17f229437f1c97e536248cdb66141a6a1e0c74ac4bc
- Candidate group: PR264 and PR270; group-equivalent eligible.
- Both print Assault[character], gain +2 level on a resolved incident, and on
  self-enter gain Assault[incident] for the turn when own scene has at least
  three effective level-7 characters.
- Controls: B08050 level delta, PR187 Assault grant, D08003 level-count gate,
  and B08059 effective-level/self-count caution.
- Prove unresolved/resolved, effective counts 2/3/4, source self-count at level
  7, decoys, enter-only trigger, expiry, public action legality, CPU, and owner.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves74-75 and write the next handoff.

Remaining estimate: about 1,468 records, roughly 125-270 agent hours or 33-75
wall hours with four-way parallel work before future grouping gains.
