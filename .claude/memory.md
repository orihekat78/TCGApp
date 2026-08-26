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

- Waves178-179 move sixteen items to matched. Coverage is 2072 matched / 892
  test-missing / 2964 total; 786 exact groups remain, including 680 singletons.
- BUG-379 moves B08034/B08034P reasoning reactions from `reasoning:end` to the
  official pre-Mislead/evidence `reasoning:after-sleep` window.
- Full functional Vitest, lint, smoke, focused public tests, adjudication, and
  horizontal scan pass. Release suites still need the normal clean post-commit run.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves180-181 batch sixteen items across B08048-B08062. B08054 has a confirmed
  missing set-card leave replacement and must be isolated as T3 before alignment.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 87 waves remain through Wave266.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
