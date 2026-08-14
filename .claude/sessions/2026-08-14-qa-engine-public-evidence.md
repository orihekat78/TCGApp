# QA engine and public-evidence decisions

## Safari storage and HOME identity cards

- Queue IndexedDB writes from request success callbacks; Safari may deactivate a
  read/write transaction before an awaited continuation resumes.
- Apply the rule to cloud sync state and history Replay artifact persistence.
- HOME identity art needs a route-scoped high-specificity `contain` rule so
  lazy game-card CSS cannot crop partner or incident cards after navigation.

## Global turn-boundary reset

- Turn-scoped flags reset for both players at the start of every turn, before
  `turn:start`; `startTurn` owns the canonical boundary.
- Do not reset in `endTurn`; queued end-phase effects can still read the ending
  turn's state before the next turn starts. See `BUG-303`.

## Ordered pending-pick provenance and public guard

- Every bespoke `preparePendingPickRange` producer uses canonical
  `pendingSource`; dropping batch/order provenance can resolve siblings early.
- Public guard prechecks allow null abort for a missing action target, then
  enforce the live `mustGuardCandidates` set.

## Partner-area and action-removal evidence

- Partner exclusion needs paired fixtures with the same printed name in partner
  and scene areas; a differently named scene target is a false green.
- Choose-intercept excludes event sources. Broader event semantics need separate
  official-rules adjudication.
- Face-up evidence rulings bind to public declare, guard, judge, and Hirameki
  decisions. Generic removal tests are insufficient.
- Keep QA-bound assertions dedicated so unrelated edits do not silently move
  line-based evidence.
