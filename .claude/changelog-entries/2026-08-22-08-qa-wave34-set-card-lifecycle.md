## QA Wave 34 — set-card public lifecycle

- Certified twelve official QA records across twenty-three printings through public-dispatch lifecycle cases.
- Proved event use creates a `charSetCard` decision, attaches the physical event face up, and keeps it out of remove until its host leaves.
- Proved host removal sends both the character and attached event to remove and leaves no orphan set-card state.
- Fixed B02067/P so their printed event-use line can set the event on one red character.
- Preserved B02067's shipped `a1` choose-intercept ID while restoring the omitted set ability as `a0`.
- Derived B02067P from B02067 and verified eleven parallel-printing pairs remain mechanically identical.
- Fixed duplicate B02067/P set cards so each physical card grants and consumes its own `turn1` choose-intercept occurrence.
- Carried set-card instance identity through pending state, JSON restoration, authority checks, dispatcher actions, and UI choices.
- Rejected missing or mismatched set-card identities transactionally and retained deterministic legacy-state backfill.
- Horizontally scanned every event CardDef with set text or on-set scope; no second missing `charSetCard` path remains.
- Recorded generic triggered and declared `on-set-host` occurrence identity as the next separate engine wave.
- Advanced exact official-QA coverage from 1,206 to 1,218 matched records; test-missing falls from 1,758 to 1,746.
