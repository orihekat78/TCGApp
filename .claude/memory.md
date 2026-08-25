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

- Waves162-163 move fourteen items to matched. Coverage is 1928 matched / 1036
  test-missing / 2964 total; 919 exact groups remain, including 802 singletons.
- Official B06091 Q&A reverses the old BUG-097 reading: the bearer is the
  original action target and the other guard gets active/AP+2000. D11016 shares
  the corrected definition; no engine change was needed.
- B06092/B06093/B06095/P/B06098/P and B06103/P-B06109/P public matrices cover
  Cut-In, Misread, all-area traits, MR scene counts, named bans, exact costs,
  restriction exceptions, and multi-color incident identity.
- Target/legacy 63 and focused horizontal 328 tests pass; both TypeScript
  projects, focused ESLint, QA/docs/bug checks, and diff checks pass.
- Waves164-165 batch nineteen CT-P07 items across B07001/P/P2-B07015/P.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 50-110 working hours, center about 80 hours; roughly
  30-70 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
