# Next Task: QA adjudication Waves72-73

Resume qa/adjudication-wave-20260814-13 after the Waves70-71 commit.

## Completed

- Waves70-71 certify twelve records across twenty-one target printings.
- No production change was required. Rules and adversarial reviews pass.
- Coverage is 1484 matched / 1480 test-missing / 2964 total.
- Existing untracked pnpm-lock.yaml and pnpm-workspace.yaml stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read .claude/sessions/2026-08-24-qa-waves70-71.md and current QA trace.
4. Fetch current CT-P06/P07/P10/PR01 authority only into a separate `.tmp`
   staging root. Never run `npm run cards:fetch` against live cards-data.

## Wave72

- Question hash:
  701c4eca60e7d901e2e2dd9f5c0eedd8cb13a555be8e02265d53d19a3be83371
- Answer hash:
  2c60b49e60c88e7551164d81261d4f3a0e591b10d837f965019e3e67a007c6b1
- Exact Q&A: there is no upper limit on the number of cards in the partner area.
- Remaining records: B07030, B07059, B07061, B10046, PR196, PR297.
- Physical sources: B07030/P/P2, B07059/P, B07061/P, B10046, PR196, PR297
  (ten).
- Matched controls: B07060/P, PR195, PR291.
- Prove repeated placement beyond ordinary board counts, owner orientation,
  source-area removal, identity/order, persistence, CPU, and malformed targets.

## Wave73

- Question hash:
  3a4d85c6bd12ba928b1cd75c2f042242cb9dc25e86965562b83eb0995b64b000
- Answer hash:
  caedd0010da4d392046a04456bad3c537f47cf9b0d2b3598bf277055792a4d11
- Exact Q&A: if the owner's deck has fewer than three cards, removing all of
  them does not pay an exact-three declared cost; the ability cannot be used.
- Remaining records: B06020, B07001, B10085, B10089, PR292, PR298.
- Physical sources: B06020, B07001/P/P2, B10085/P, B10089, PR292, PR298
  (nine).
- Matched controls: PR305, PR308, PR314.
- Prove deck sizes 0/1/2, exact three, owner=`opp`, transactional no-removal,
  refresh/deck-out boundaries, CPU, and every physical source.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves72-73 and write the next handoff.

Remaining estimate: about 1,480 records, roughly 126-272 agent hours or 33-76
wall hours with four-way parallel work before future grouping gains.
