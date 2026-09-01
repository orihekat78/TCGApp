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

- Waves188-189 move sixteen B09006-B09024 rows to matched. Coverage is 2156
  matched / 808 test-missing / 2964 total; 706 exact groups remain, including
  604 singletons. No production code changed.
- Public owner mirrors cover independent optional steps, continuous state,
  full-scene switch, LP override lifetime, resolved guard AP, name branches,
  Misread windows, Cut-In versus disguise, FILE no-op, contact attribution,
  granted-trigger multiplicity/batch snapshot, and reveal-cost lifetime.
- Focused 34, TypeScript, scoped ESLint, QA merge/generated docs/baseline lint pass.
- The prior long-lived task ran Sol/ultra and reused about 0.65M input tokens per
  turn. Continue in fresh Terra/high tasks, two waves per task, without agents
  for certification-only work.
- `pnpm exec` attempts an install and fails `ERR_PNPM_IGNORED_BUILDS`; use
  worktree-local binaries without approving or changing dependencies.
- Release-only dirty-worktree and pnpm-junction `jose` gates remain isolated;
  do not relax the private-hosted security allowlist.
- Generic policy-free sequence pre-walk can still preselect a later PA target
  before an earlier PA mutation. B07104 heuristic and human paths avoid it;
  investigate this engine-wide ordering risk when a future card exposes it.
- Waves190-191 moved sixteen B09026-B09055 rows to matched. Coverage is 2172
  matched / 792 test-missing / 2964 total. BUG-383 now snapshots effective
  hand level before discard/cost payment and rejects stale hand picks.
- Full Vitest reaches completion but internally recurs `CARDS_DATA_BUSY` with
  one worker and no external holder. Native release prepare is clean; preserve
  the lock and isolate test-host writer overlap separately.
- Wave192 moved eight B09056-B09064 rows to matched. Coverage is 2180 matched /
  784 test-missing / 2964 total. BUG-384 moves B09063's opponent-level blocker
  from the pre-trigger gate into effect resolution so blocked draw still consumes
  【ターン1】. Focused regression is 14 files / 351 tests.
- Wave193 only starts with B09073-B09080 rows in the next-task prompt.
- Local raw drift `ct-d01-api.json` remains separate from the tracked snapshot.
- About 77 waves remain through Wave267.
- Preserve untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
- Reconcile root AGENTS manual Ver2.4 versus rules INDEX Ver2.5 separately.
- Waves193-194 moved sixteen B09073-B09092 rows to matched: 2196 matched /
  768 test-missing / 2964 total. No production code changed.
- Wave195 starts with the remaining B09092 row, then B09093-B09096; prompt is
  updated. Broad gate remains Wave200.

## 2026-09-01: CT-P09 Q&A Waves195-196

- Certified sixteen B09092-B09104 rows as `matched/aligned` with two bounded
  card-specific proof files (9 tests); production code is unchanged.
- B09096's supplied candidate hash lacked its final `a`; the tracked snapshot
  canonical ID was used and verified.
- Preserve inherited lockfiles and B10006 test; raw ct-d01 drift excluded.
- Horizontal review reused B09096 dynamic-AP, B09097 chain, and B09104
  printed-ability test paths; no same-pattern production gap was found.

## 2026-09-01: CT-P09 Q&A Waves197-198

- Certified four B09105, three B09106, and one B09107 Q&A rows as
  `matched/aligned`; production code is unchanged.
- Added two bounded proof files (5 tests). Focused Vitest, TypeScript, QA merge,
  QA baseline lint, and generated QA trace all pass.
- Horizontal review reused B09105 S1 defer, B09106 effect-entry, and B09107
  alternate-defeat paths; no same-pattern production gap was found.

## 2026-09-01: CT-P09 Q&A Waves199-200

- Certified four B09108, one B09110, two B09111, and one B09112 Q&A rows as
  `matched/aligned`; production code is unchanged.
- Added two bounded proof files. Focused 5-test proof and 29-test relevant
  runtime regression, TypeScript, QA merge, generated trace, and QA lint pass.
- Broad Vitest was attempted with default and single-worker modes, but both hit
  `CARDS_DATA_BUSY`; existing release checks also failed. Agent-owned trees were
  terminated after ancestry verification. This gate remains unresolved.
- Horizontal review reused B09110 enter/refresh, B09111 FILE-bound, B09112
  dynamic deck-window, and registered-name consumer paths; no production gap.
