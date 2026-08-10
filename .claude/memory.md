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

## 2026-08-10: Private hosted production release

- Existing static app scope is preserved; no PvP, backend, account, telemetry,
  bundled card art, or cross-device persistence was added.
- Final qualification passed all 16 ordered gates on clean commit `9f608fd5`.
  Required inspection is build, dependency, secret, and literal-destination checks;
  advanced runtime-flow analysis remains optional.
- Exact qualified staging payload deployed to Pages project
  `conan-private-7302df07`, deployment `945de0aa-1af1-4836-86f1-b8048dc6d32e`.
- Access protects stable root and wildcard deployment domains. Sole authentication
  is One-time PIN; exact approved emails only, no Require/Exclude, session <=12h.
- Operator config remains outside the repo and contains IDs/emails only. Temporary
  setup token was revoked; no credential enters chat, Git, config, logs, or evidence.
- Anonymous root/deployment probes redirect to Access. OTP login and game opening
  were accepted on PC and smartphone.
- Operational changes use the production runbook: qualify exact staging, probe both
  domains, add/remove exact emails on both apps, contain before rollback or rights work.
