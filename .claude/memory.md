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

- Waves164-165 move nineteen items to matched. Coverage is 1947 matched / 1017
  test-missing / 2964 total; about 901 exact groups remain, including 785
  singletons.
- BUG-370 fixes parent/child decision order: an active pending pick permits only
  exact physical/provenance authority or an explicit resume carrier to cross
  the stack boundary. GameState/save/public API shapes are unchanged.
- B07001/P/P2-B07015/P public matrices cover zero choices, owner orientation,
  short-deck refresh, simultaneous entry, RPS repetition, and owner-order.
- Full Vitest, full desktop/mobile Playwright, TypeScript, ESLint, smoke 1000,
  QA merge/lint, and Sol engine review pass.
- Waves166-167 batch eighteen CT-P07 items across B07017/P-B07039/P.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 47-107 working hours, center about 77; roughly 28-68
  implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
