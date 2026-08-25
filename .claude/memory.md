# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-157: matching dated records under `.claude/sessions/`.
- Throughput: focused per-wave proof, one gate/commit/push per two waves, broad
  gates every ten waves or immediately for T3/publication.
- Certification-only work uses no agents. Production/T3 uses at most three
  read-only reviewers.

## Next

- Waves156-157 move eight items to matched. Coverage is 1887 matched / 1077
  test-missing / 2964 total; 954 exact groups remain, including 831 singletons.
- B06049 entry condition is a one-time snapshot; its turn-scope `突撃` persists.
  The old suppression DEFER is closed because the engine lane already ships.
- B06050/P one-of-two Cut-In choice and off-turn conditional no-op complete.
- B06052 hand-paid re-entry/source switch and B06053/P forced reveal/no-match
  behavior complete. All four cards needed tests/docs only; production unchanged.
- Target 24 and focused horizontal 183 tests pass; exact evidence is in the
  Waves156-157 session record. Broad T3 gates carry from Waves154-155.
- Wave158 batches B06057/B06058. Wave159 batches B06062/B06063/B06064.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 56-117 working hours, center about 87 hours; roughly
  36-76 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
