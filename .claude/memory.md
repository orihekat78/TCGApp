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

- Waves172-173 move nineteen items to matched. Coverage is 2021 matched / 943
  test-missing / 2964 total; 834 exact groups remain, including 725 singletons.
- B07085-B07098/P public matrices cover forced reveal, independent branches,
  owner evidence/hand costs, turn-end, effective level, removal, and refresh.
- Production gap is none. Wave suites 54/54, focused horizontal 465/465,
  TypeScript, scoped ESLint, and QA merge pass.
- Waves174-175 batch nineteen items across B07100-B08016.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 93 waves remain through Wave266.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
