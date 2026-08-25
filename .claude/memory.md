# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-163: matching dated records under `.claude/sessions/`.
- Throughput: focused per-wave proof, one gate/commit/push per two waves, broad
  gates every ten waves or immediately for T3/publication.
- Certification-only work uses no agents. Production/T3 uses at most three
  read-only reviewers.

## Next

- Waves166-167 move eighteen items to matched. Coverage is 1965 matched / 999
  test-missing / 2964 total; about 884 exact groups remain, including 769
  singletons.
- BUG-371 restores B07033/P/P2 FILE6 Disguise append-only. BUG-372 preserves
  detached set-card observers across simultaneous batch removal without
  persisting snapshots. BUG-373 limits B07034/P to face-down leaves.
- B07017/P-B07039/P public matrices cover effect contacts, optional branches,
  owner-only costs, no-target triggers, full-scene switch, and multiple observers.
- Full Vitest, TypeScript, ESLint, smoke 1000, QA merge/lint, Sol review, and
  targeted desktop/mobile B07033 Playwright pass. One unrelated B08054 full-suite
  bootstrap timeout passed immediately in isolated rerun.
- Waves168-169 batch eighteen CT-P07 items across B07043-B07056/P.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At nine exact groups per wave, the current queue is about 99 waves, ending near
  Wave266; recalculate after every two-wave batch.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
