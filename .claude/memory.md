# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-159: matching dated records under `.claude/sessions/`.
- Throughput: focused per-wave proof, one gate/commit/push per two waves, broad
  gates every ten waves or immediately for T3/publication.
- Certification-only work uses no agents. Production/T3 uses at most three
  read-only reviewers.

## Next

- Waves158-159 move twelve items to matched. Coverage is 1899 matched / 1065
  test-missing / 2964 total; 943 exact groups remain, including 821 singletons.
- B06057 event observer excludes Cut-In/Hirameki and mandates ordinary-use draw.
- B06058 effective-LP0 target and post-reactivation repeat action complete.
- B06062/P-B06064/P no-host/mandatory-set matrix, short-deck refresh, double
  rider stack, and face-up event/host leave timing complete.
- All five cards needed tests/docs only; production unchanged. Target 49 and
  focused horizontal 251 tests pass; exact evidence is in the session record.
- Wave160 batches B06060/B06067/B06071/B06072. Wave161 batches B06076/B06077/
  B06085/B06086 and runs the scheduled broad gate.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 54-115 working hours, center about 85 hours; roughly
  34-74 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
