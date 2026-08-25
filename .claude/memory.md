# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-155: matching dated records under `.claude/sessions/`.
- Throughput: focused per-wave proof, one gate/commit/push per two waves, broad
  gates every ten waves or immediately for T3/publication.
- Certification-only work uses no agents. Production/T3 uses at most three
  read-only reviewers.

## Next

- Waves154-155 move eight items to matched. Coverage is 1879 matched / 1085
  test-missing / 2964 total; 962 exact groups remain, including 839 singletons.
- B06046/P mandatory Turn2 activation, no-decline, hand-paid re-entry, and
  source-self switch complete without production changes.
- B06047 now ships a static-filter cross-hand event-level aura at the shared
  effective level reader. It stacks per physical scene source and changes no
  GameState/save shape.
- B06034, B06062/P, B06063/P, and B06064/P retain official YAIBA traits.
- T3 full functional/lint/docs/QA/smoke/Playwright and independent reviews PASS;
  exact evidence is in the Waves154-155 session record.
- Wave156 batches B06049/B06050. Wave157 batches B06052/B06053; start with
  certification and upgrade only on a reproduced engine gap.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 57-119 working hours, center about 89 hours; roughly
  38-78 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
