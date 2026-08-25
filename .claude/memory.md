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

- Waves168-169 move eighteen items to matched. Coverage is 1983 matched / 981
  test-missing / 2964 total; 868 exact groups remain, including 755 singletons.
- BUG-374 carries optional semantic labels through runtime and declared choice
  paths. BUG-375 publishes seven hand-reveal printings with closeable lifetime.
- B07043-B07056/P public matrices cover split names, continuous modifiers,
  owner costs, guarded contact identity, refresh, optional branches, and stun.
- Functional full Vitest, TypeScript, full ESLint, smoke 1000, QA merge, full
  desktop/mobile Playwright, and Sol review pass. Clean release runs after commit.
- Waves170-171 batch nineteen CT-P07 items across B07057/P-B07079/P.
- Official sync drift remains separate: PR322 and changed B04018/B04018P/
  B06103P Q&A require re-queueing.
- At nine exact groups per wave, about 97 waves remain through roughly Wave266.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
