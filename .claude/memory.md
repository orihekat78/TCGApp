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

- Waves186-187 move sixteen items to matched. Coverage is 2140 matched / 824
  test-missing / 2964 total; 722 exact groups remain, including 620 singletons.
- BUG-381 adds exact human `revealFromHand` occurrence selection and a public
  cost-completion presentation. Invalid/duplicate indices reject; AI/legacy
  keeps deterministic fallback.
- BUG-382 assigns only `hand:reveal` cost reactions to the declared effect's
  batch. B05088/B07034 retain ordinary cost-trigger owner order; B09004/B10006
  wait for the current effect. Failed activation restores the reveal FIFO.
- Wave public 24, focused 130, TypeScript, full lint, QA, functional full Vitest
  13734, smoke 1000, Playwright full 477, and reveal-cost browser 2/2 pass.
- Release-only dirty-worktree and pnpm-junction `jose` gates remain isolated;
  do not relax the private-hosted security allowlist.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves188-189 start with sixteen B09006-B09024 rows; B09016/B09022/B09023/
  B09024 require exact grounding before test authoring.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 80 waves remain through roughly Wave267.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
