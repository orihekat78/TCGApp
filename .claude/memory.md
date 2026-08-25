# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-153: matching dated records under `.claude/sessions/`.
- Throughput: focused per-wave proof, one gate/commit/push per two waves, broad
  gates every ten waves or immediately for T3/publication.
- Certification-only work uses no agents. Production/T3 uses at most three
  read-only reviewers.

## Next

- Waves152-153 move eight items to matched. Coverage is 1871 matched / 1093
  test-missing / 2964 total; 970 exact groups remain, including 847 singletons.
- BUG-368 preserves B05092 mandatory shuffle on voluntary zero and no candidate.
- BUG-369 reconciles settled human guard-window actions immediately after
  actor/target departure; AI, GameState, and activeActionId timing now agree.
- B06034 completes without source change across movement, suppression bypass,
  inactive conditions, and self-flip.
- T3 full functional/lint/smoke/Playwright and three independent reviews PASS;
  exact evidence is in the Waves152-153 session record.
- Wave154 completes four B06046/P items. Wave155 completes four B06047 items;
  B06047 a1 needs the known filtered cross-hand event-level aura.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 58-121 working hours, center about 90 hours; roughly
  40-80 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
