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

## 2026-09-01: QA Waves201-202

- Certified four B09112/B09113 and five B10004/B10005/B10009 rows as
  `matched/aligned`; production code is unchanged.
- Added two bounded proof files. Focused 30 tests, TypeScript, QA merge,
  regenerated trace/baseline, and QA lint pass.
- Broad Vitest remains the inherited `CARDS_DATA_BUSY` harness blocker; not a pass.
- Horizontal review reused named selection, evidence positions/no-op choice,
  B10004 declared-count, B10005 end phase, and B10009 partner-color paths.

## 2026-09-01: QA Waves203-204

- Certified eight B10009-B10018 CT-P10 Q&A rows as `matched/aligned` with two
  bounded direct proof files; production code is unchanged.
- Focused 18 tests, TypeScript, QA merge, regenerated trace, QA lint, and
  `git diff --check` pass. Broad Vitest remains the inherited `CARDS_DATA_BUSY`
  harness blocker; it is not a pass.
- Horizontal review covered effect-entry AP, bonded event-removal immunity,
  Cut-In contact scope, continuous field traits, conditional 迅速, and event-use
  set-card declaration paths; no production gap was found.

## 2026-09-02: QA Waves221-222 closure

- Certified exactly 43 former CT-P02 `test-missing` rows: Wave221 B02002-B02050
  (23) and Wave222 B02051-B02087 (20). Every row has one direct assertion in
  the two bounded certification tests; no production or raw-authority change.
- The pinned normalized-Q&A hash remains
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- Fresh closure check: 2 files / 4 tests, application and script TypeScript,
  scoped ESLint, QA merge (`all-adjudicated=true`), and QA lint (0 issues) pass.
  CT-P02 has zero `test-missing`; the global queue has `unreviewedCount=0`.
- Broad Vitest was not run. `CARDS_DATA_BUSY` and release-test failures remain
  unresolved. No further Q&A row may be selected without a new explicit boundary.
