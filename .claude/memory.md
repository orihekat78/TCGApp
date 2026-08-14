# Session memory

## 2026-07-29 Engine adversarial review

- Full record: `.claude/sessions/2026-07-29-engine-adversarial.md`.

## 2026-08-10: Private-hosted release and UI quality

- Rotated release and UI evidence:
  `.claude/sessions/2026-08-14-qa-wave13-match-cost.md`.
- Full UI session:
  `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.

## 2026-08-12: Safari storage and HOME identity cards

- Queue IndexedDB writes from request success callbacks; Safari may deactivate a
  read/write transaction before an awaited continuation resumes.
- Apply the rule to cloud sync state and history Replay artifact persistence.
- HOME identity art must use a route-scoped high-specificity `contain` rule so
  lazy game-card CSS cannot crop partner or incident cards after navigation.

## 2026-08-13: Global turn-boundary reset

- 【ターン①/②/③】and other turn-scope flags reset for both players at the start
  of every turn, before `turn:start`; `startTurn` owns the canonical boundary.
- Do not move this reset to `endTurn`: queued end-phase effects may still read the
  ending turn's state before the next turn starts. See `BUG-303`.

## 2026-08-14: Ordered pending-pick provenance

- Every bespoke `preparePendingPickRange` producer must use the canonical
  `pendingSource` builder. Dropping batch/order provenance can resolve a sibling
  effect early and leave a surfaced decision without runtime authority.
- Public guard prechecks must preserve the core ordering: allow a null abort for
  a missing action target, otherwise enforce the live `mustGuardCandidates` set.

## 2026-08-14: Partner-area exclusion evidence

- Prove partner exclusion with paired fixtures using the same printed name in
  the partner area and the scene; a differently named scene target is a false green.
- Choose-intercept currently excludes event sources. Do not certify broader
  event semantics without separate official-rules adjudication.

## 2026-08-14: Action-removal Hirameki evidence

- Bind face-up evidence rulings to the public declare, guard, judge, and
  Hirameki decision path; generic removal tests are insufficient.
- Keep QA-bound assertions in dedicated files so unrelated test edits do not
  silently invalidate line-based evidence references.

## 2026-08-14: Exact declared-cost selection and compact MATCH

- Human `sleepChar` and `stunChar` costs use exact UID witnesses and reject
  malformed, stale, duplicate, wrong-filter, or wrong-count claims.
- Compact incident status belongs to the incident header. Candidate incident
  cards hide their detail control so the whole card remains the pick target.
- Full record: `.claude/sessions/2026-08-14-qa-wave13-match-cost.md`.

## 2026-08-14: B06042 effect-contact evidence

- Bind each qaId to a dedicated public-dispatch test block; file-level markers
  and cross-row assertion references are false-green evidence.
- Effect-generated contact must prove target authority, suppressed normal-action
  hooks, exact contact count, and the zero-contact decline path.
