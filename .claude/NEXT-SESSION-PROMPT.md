# Next Task: QA adjudication Waves78-79

Resume `qa/adjudication-wave-20260814-13` after the Waves76-77 commit.

## Completed

- Wave76 certifies B06067/P self-selection and contact-trigger behavior.
- Wave77 certifies PR099 with PR105 as matched twin control.
- Rules and adversarial reviews pass. Coverage is 1501 matched / 1463
  test-missing / 2964 total.
- Existing untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` stay protected.

## Start

1. Read root/nested AGENTS, conan-router, card-wave, and conan-verify.
2. Verify branch, HEAD/upstream, status, and protected files read-only.
3. Read `.claude/sessions/2026-08-24-qa-waves76-77.md` and current QA trace.
4. Fetch only needed authority into a separate `.tmp` root. Never write live
   ignored cards-data.

## Wave78

- Exact tuple: Q `a9a0240895edc64359332491c4e76c69ea0d575b71d3a60a93fce1ca90c4274d`,
  A `cfa3c372e070cc760a9e1622375347c45c1b2f05342c71656e44de9077adf77b`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Target QA IDs use suffix
  `40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55`:
  B01039, B02031, B02052, and B02067.
- Physicals: B01039; B02031/P; B02052/P; B02067/P.
- Matched controls: B01023/P, B01057/P, B02013/P, B05117/P, D10024.
- Ground the exact set-card/host contracts, then prove privacy, occurrence
  identity, owner=`opp`, host absence/leave behavior, atomic rejection, CPU,
  and save where applicable.
- Exclude B02084: same question/QA suffix but different answer hash.

## Wave79

- Exact tuple: Q `51af55e3a8f5e310ad274dfeaf866ba406503b4bbee612cd4d95d40fa0611e23`,
  A `863ba7507bdba87e23fac09c79b03864353d45b38637b01e943ef9b6f1dee775`,
  section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Target QA IDs use suffix
  `b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1`:
  B01065, B01069, and B02061.
- Physicals: B01065/P, B01069, B02061. No matched exact-group control.
- Ground each card before defining the shared public matrix. Cover real enter,
  optional accept/decline, opponent evidence ownership, zero target, Hirameki
  fire/skip, owner=`opp`, CPU, save, and transactional rejection as applicable.
- Exclude B03066/B03068/B03069: same question/QA suffix but different answers.

## Gates and stop

- Bind exact QA comments and assertion evidence for every target record.
- Run focused/full tests, typecheck, lint, QA/docs/static gates, smoke1000, and
  isolated representative/full-match Playwright.
- Require rules and adversarial review before commit/push.
- Stop after Waves78-79 and write the next handoff.

Remaining estimate: 1463 records, about 124-269 agent-hours or 33-75 wall
hours with four-way parallel work before future grouping gains.
