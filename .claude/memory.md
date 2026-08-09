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

- Static-only scope; no Cloudflare resource or endpoint was created.
- Browser registry no longer exposes its unused dynamic Node loader; direct
  Node-only `loadSet` remains tested.
- Official remote card images and local SVG failure placeholder are unchanged;
  card art is absent from `dist` and browser storage.
- Exact headers/toolchain and release tests reject server files, source maps,
  Node chunks, and card payloads. Full gates and both reviews passed.

## 2026-08-04: Private hosted Phase 2 payload authority

- Inspected-payload scope; no Cloudflare resource, upload, or endpoint exists.
- A clean canonical HEAD, pinned toolchain, two identical builds, and ignored-input
  audit precede atomic staging and repo-external evidence publication.
- The fixed launcher clears ambient authority and pins CWD/cache/temp. Full gates
  and final adversarial review passed; no engine, UI, or caller changed.

## 2026-08-04: Private hosted Phase 3 and Phase 4 Tasks 1-2

- Existing scope is preserved. Only set-card decision IDs, hand occurrence IDs, and
  44px tap targets changed; no PvP, backend, account, persistence, resource, or upload.
- Qualification requires a repo-external report naming the exact clean commit and gates.
- External operator JSON caps the named audience at 12 and rejects unsafe paths or ACLs.
- Lockfile vendor code is split and SHA-256 pinned; pin changes require requalification.
- Access audit requires a dedicated account, sole Cloudflare IdP, root/wildcard apps,
  exact audiences, session limits, and Block Everyone containment.
- User-operated account and dashboard setup begins at Phase 4 Task 3; stop before it.
- Browser qualification fixed set-card payload validation and stable area-qualified IDs.
- Pending/headless runtime uses own descriptors; inherited accessors cannot alter identity.
- Boundary follows callable timer provenance, typed iframes, and cyclic browser aliases.
- Access pagination must be complete; config writes are limited to operator/system/admin.
- Invocation flow tracks qualified `Reflect.apply` and hoisted local-callable identity.
- React trust rejects exposed factories and opaque, projected, or sibling mutations.
- Computed iframe keys use access-point values; local browser-named models stay plain.
