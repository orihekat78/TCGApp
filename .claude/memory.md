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

- Waves182-183 move eighteen items to matched. Coverage is 2106 matched / 858
  test-missing / 2964 total; 755 exact groups remain, including 652 singletons.
- Production CardDefs/engine already matched all rulings. New public proofs cover
  MR overwrite, reveal lifetime, remove-exit cost observers, duplicate reserve,
  dynamic AP/split names, and turn-end trigger/resolution boundaries.
- Focused structural matrix 128, TypeScript, scoped ESLint, QA reviewed gate, and
  Sol semantic review pass. Broad Vitest/smoke stays on the ten-wave/T2-T3 cadence.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves184-185 start with eighteen ungrounded rows across B08075-B08091; re-ground
  before interpreting the hashes.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 84 waves remain through roughly Wave267.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
