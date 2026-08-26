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

- Waves180-181 move sixteen items to matched. Coverage is 2088 matched / 876
  test-missing / 2964 total; 772 exact groups remain, including 668 singletons.
- BUG-380 adds B08054's synchronous hidden-set return for opponent effect/contact,
  optional persisted attribution, legacy fail-closed hydration, and queued-observer
  hidden-identity redaction.
- Focused 128, TypeScript, full ESLint, smoke1000/baseline, Playwright 28, QA merge,
  horizontal scan, and Sol review pass. Two release suites require clean post-commit rerun.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves182-183 start with eighteen ungrounded rows across B08062-B08073; re-ground
  before interpreting the hashes.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 86 waves remain through roughly Wave267.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
