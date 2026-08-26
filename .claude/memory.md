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

- Waves184-185 move eighteen items to matched. Coverage is 2124 matched / 840
  test-missing / 2964 total; 738 exact groups remain, including 636 singletons.
- Production CardDefs/engine already matched all rulings. New public proofs cover
  ordered options, cost-after-state, refresh-safe invoke, forced event picks,
  continuous AP, naming state, and full-scene switch.
- New tests 38, horizontal 294, TypeScript, QA, smoke 1000, and Sol review pass.
  Full Vitest functional lane has 13812 passes; release-only clean/junction gates
  remain environment-bound. Playwright's stale B08034 fixture was corrected and
  its desktop/mobile rerun is 4/4.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves186-187 start with sixteen ungrounded rows across B08092-B09005; re-ground
  before interpreting the hashes.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At about nine exact groups per wave, about 82 waves remain through roughly Wave267.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
