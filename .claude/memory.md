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

- Waves160-161 move fifteen items to matched. Coverage is 1914 matched / 1050
  test-missing / 2964 total; 931 exact groups remain, including 812 singletons.
- B06060/B06067/P/B06071/P/B06072/P public matrices cover repeat actions,
  mandatory observers, named-state gating, non-targeting stun, and sequential
  remove-count resolution.
- B06076's omitted declared ability is appended as a3/index2; shipped a1/a2
  occurrence identities remain stable. B06077/P-B06086/P public flows complete.
- Target 43 and focused horizontal 411 tests pass. Full Vitest, ESLint,
  smoke1000/baseline, and desktop/mobile human-vs-CPU Playwright pass.
- Waves162-163 complete the remaining thirteen CT-P06 items across B06091,
  B06092, B06093, B06095/P, B06098/P, B06103/P, B06105/P, and B06109/P.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- Remaining estimate: 52-112 working hours, center about 82 hours; roughly
  32-72 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
