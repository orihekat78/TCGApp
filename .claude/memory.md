# Session memory

## 2026-07-29 Engine adversarial review

- Baseline is verified `origin/main` `427ee8b2`; work is isolated in
  `codex/engine-adversarial-20260729`. The UI-quality worktree and its 63
  changed paths are not a baseline and must not be merged directly.
- Read-only review covered rules, `GameState`, resolver, re-entry,
  simultaneous effects, hidden information, Replay determinism, and public
  consumers before implementation began.
- Confirmed 16 defects: 15 from the `origin/main` read-only review, plus one
  Replay React-update violation found during real-browser verification. All
  are fixed on the dedicated branch. A branch-only browser import regression
  and one stale terminal E2E fixture were corrected but are not counted.
- Resolver decisions now have state-owned serialized runtime, stable IDs,
  dispatch rollback, decision identity, and hard pause boundaries. Restores
  hydrate the exact pending continuation without module-counter collisions.
- End-turn work is a staged serializable transition. Simultaneous candidates
  are revalidated, leave intercept is state-owned, and action/contact paths
  avoid duplicate resolution.
- Replay v2 captures random/time, validates moves and result contracts, and
  isolates human identity plus pending resolver runtime for full and prefix
  playback. `runMatch`, MCTS, and MCTS-tree restore caller runtime.
- Hidden log details are audience-redacted before `LogPanel` and toast
  consumption. CPU/spectator drivers preserve public reveal presentation and
  stop until effect/reveal decisions clear.
- Final Vitest: 885 files / 7029 tests PASS, with 5 files / 197 tests skipped.
  Typecheck, lint, build, bug/listener/side-channel lint, auxiliary commit
  lints, and diff check pass. Known warning-only baselines remain.
- Fresh isolated-port Playwright: 24/24 PASS across desktop and `851x393`,
  including Replay, leave intercept, public-hand/deck reveal, spectator speed,
  mobile controls, and full human-vs-CPU matches; console errors are zero.
- Independent engine/state and consumer/hidden-information reviewers return
  PASS with no P0/P1 findings. Final QA-trace review also returns PASS with no
  P0/P1 or false-green finding.
- Horizontal review found no remaining public raw decision dispatch and no
  private deck/reveal surface exposed to spectator consumers.
- The separate UI-quality worktree continued independently from 63 to 69
  changed paths during this task. It remains unmerged and untouched here.

## 2026-08-04: Private hosted Phase 1 static boundary

- Scope is static-release preparation only. No Cloudflare resource or public
  endpoint was created; later release phases own Access policy and deployment.
- The browser registry no longer exposes the unused dynamic Node loader.
  Direct Node-only `loadSet` remains supported and has an always-running test.
- Existing card-image behavior is unchanged: official remote URLs at runtime
  with the deterministic local SVG placeholder on error. No card art is built
  into `dist` or stored by a browser image helper.
- Release tests pin one exact `_headers`, Node/npm/Wrangler versions, and reject
  source maps, server/runtime files, Node browser chunks, and known card-image
  payloads. Unrelated UI raster assets remain permitted.
- Setup, README, and both CI workflows enforce Node 24.x and npm 11.12.1.
  Local setup runs `npm ci` on every launch and fails closed instead of reusing
  a potentially partial dependency installation.
- Horizontal search found no product caller of removed `cards.load`, image
  fetch/cache helpers, or other browser import of the Node TSV loader.
- Final gates pass: typecheck, production build, 887 Vitest files / 7,028
  tests, 1,000-game smoke with zero timeout/exception, full lint and commit
  lints, generated-doc check, diff check, and production dependency audit.
- Review iterations closed two P2 findings: incomplete toolchain propagation,
  then dependency-install fail-open plus stale README guidance. Final
  adversarial review is OK with no P0-P3; horizontal audit is OK with no
  P0-P2 and only a non-blocking source-string-test maintenance note.

## 2026-08-04: Private hosted Phase 2 payload authority

- Scope is inspected payload creation only. No Cloudflare resource, upload, or
  public endpoint was created.
- Preparation requires the canonical clean HEAD, reviewed raw Vite config,
  pinned toolchain, two identical builds, and post-build ignored-input audits.
- The fixed PowerShell launcher clears ambient authority, pins its CWD and TSX
  config/cache/temp, and leaves dependency trust to Phase 3's preceding npm ci.
- Staging and evidence are separate, deterministic, and atomically published.
- Focused release tests pass 140/140 with one platform skip. Final adversarial
  review is OK with no P0-P3; no engine, UI, or product caller changed.
- Final gates pass: typecheck, production build, 889 Vitest files / 7,168
  tests, full lint, generated-doc check, diff check, and dependency audit.
