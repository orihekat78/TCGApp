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

- Waves174-175 move nineteen items to matched. Coverage is 2040 matched / 924
  test-missing / 2964 total; 816 exact groups remain, including 708 singletons.
- BUG-376 unifies hand Cut-In presence with `effectiveCutinAbilities`.
- BUG-377 replaces per-character mill loops with one aggregate mill and keeps
  `mill.n` runtime-bound through AI pre-walk.
- Wave suites and horizontal checks pass; Sol review has no Critical/Important.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves176-177 batch sixteen items across B08017-B08030.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 91 waves remain through Wave266.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
