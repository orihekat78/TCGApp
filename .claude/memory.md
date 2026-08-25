# Session memory

## Durable records

- Engine/release history: `.claude/sessions/2026-07-29-engine-adversarial.md`,
  `.claude/sessions/2026-08-14-qa-engine-public-evidence.md`, and
  `.claude/sessions/2026-08-21-engine-memory-rotation.md`.
- QA Waves17-149: matching dated records under `.claude/sessions/`.
- Current throughput: complete-card/shared-primitive batches, focused per-wave
  proof, one gate/commit/push per two waves, routine full gates every ten waves.
- Production/T3 defects raise review and gates; certification-only waves use no
  review agents. Maximum three subagents.

## Next

- Waves150-151 move eight items to matched. Coverage is 1863 matched / 1101
  test-missing / 2964 total; 978 exact groups remain, including 855 singletons.
- Wave150 completes B03102. BUG-367 corrects its trigger from stale
  `reasoning:end` to `reasoning:after-sleep`, before Misread/evidence.
- Wave151 completes B03112/P across ineffective/additive Cut-In, own/opponent
  effect attribution, and switch exclusion. No B03112 source change.
- Full functional Vitest, full ESLint, smoke1000, QA gates, and both independent
  reviews PASS; exact evidence is in the Waves150-151 session record.
- Sol rules and engine reviews PASS; Critical/Important zero.
- Wave152 completes four B05092 items. Wave153 completes four B06034 items;
  both CardDefs are shipped and their old DEFER rows require public reproof.
- Official sync drift remains separate: new PR322 and changed Q&A for
  B04018/B04018P/B06103P. Re-queue before mixing into tracked waves.
- Remaining estimate: 60-123 working hours, center about 91 hours; roughly
  42-82 implementation waves.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
