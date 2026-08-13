# Session memory

## 2026-07-29 Engine adversarial review

- Full record: `.claude/sessions/2026-07-29-engine-adversarial.md`.

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

## 2026-08-10: UI quality and causal presentation

- Worktree: `.claude/worktrees/home-screen-only`; branch: `codex/home-screen-only`.
- Preserve the existing playmat. Landscape mobile uses the desktop composition
  at a responsive scale; do not introduce a separate mobile board or side buttons.
- HOME, SETUP, CARDS, DECK, HISTORY, REPLAY, RESULT, TUTORIAL, SETTINGS, and
  MATCH are implemented under one header and one standard appearance.
- Shared causal presentation explains source, target, order, and result. Its
  pause, step, and skip controls never dispatch engine actions or AI steps.
- Replay artifacts are read-only projections. Loading or seeking Replay must not
  hydrate live resolver continuations or start match drivers.
- Human decision ownership and autonomous progression use shared selectors.
  Preserve the parent effect pick/choice exception for scene-switch children.
- Public full-match validation starts at `#setup`, uses rendered decisions only,
  and derives the 30-turn cap from the public first/second-player chapter tag.

## UI quality final evidence

- Vitest: 944 files / 7797 tests passed; 5 files / 197 tests skipped; 0 failed.
- Typecheck, lint, production build, and meta build passed.
- Root Playwright: 403 passed / 17 skipped; Meta Playwright: 178 passed.
- Final UI/UX adversarial review: Critical / Important 0.

## UI quality closeout

- UI defect records from the older branch were renumbered to `BUG-298` through
  `BUG-302` during main integration because main already owned `BUG-277` through
  `BUG-281`.
- The real eight-person formative study is external and remains unexecuted.
- Full session record: `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.

## 2026-08-12: Safari storage and HOME identity cards

- Queue IndexedDB writes from request success callbacks; Safari may deactivate a
  read/write transaction before an awaited continuation resumes.
- Apply the rule to cloud sync state and history Replay artifact persistence.
- HOME identity art must use a route-scoped high-specificity `contain` rule so
  lazy game-card CSS cannot crop partner or incident cards after navigation.

## 2026-08-13: Global turn-boundary reset

- 【ターン①/②/③】and other turn-scope flags reset for both players at the start
  of every turn, before `turn:start`; `startTurn` owns the canonical boundary.
- Do not move this reset to `endTurn`: queued end-phase effects may still read the
  ending turn's state before the next turn starts. See `BUG-303`.

## 2026-08-14: Ordered pending-pick provenance

- Every bespoke `preparePendingPickRange` producer must use the canonical
  `pendingSource` builder. Dropping batch/order provenance can resolve a sibling
  effect early and leave a surfaced decision without runtime authority.
- Public guard prechecks must preserve the core ordering: allow a null abort for
  a missing action target, otherwise enforce the live `mustGuardCandidates` set.
