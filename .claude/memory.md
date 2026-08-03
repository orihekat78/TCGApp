# Session memory

## 2026-08-02 HOME-only refresh

- HOME was refreshed without changing MATCH or the playmat. Layout is a 20/80
  official-news/recent-match rail plus active-deck stage.
- Header order is HOME, deck, cards, game start, tutorial, history, settings.
  Game start is the sole emphasized entry; the development `NavHUD` was removed.
- Active deck identity uses deck name, partner card, and incident card. Portrait
  and landscape incident art stays uncropped; redundant setup CTA/labels are absent.
- Official NEWS uses validated same-origin links with bounded cache and stale
  fallback. Invalid stored history dates render `日時不明` instead of crashing.
- Long active/opponent deck names truncate without horizontal overflow at
  `851x393`; menu focus, Escape, hotkeys, and 44px compact controls are covered.
- Official NEWS and recent-match headings stay fixed while their lists scroll
  independently (up to 12 entries); the page and deck stage remain stationary.
- Official NEWS cache schema is version 2. Version 1 caches created under the
  former three-item limit are invalidated once and fetched again.
- HOME deck selection is a two-column modal with fixed header/footer and an
  internally scrolling list. Selection remains provisional until confirmed;
  Escape, backdrop, close, and cancel discard it and restore trigger focus.
- `conan.meta.v1.decks` schema version 4 persists `activeDeckId`. Migration and
  deck mutations fall back to the first playable deck; unplayable saved decks
  remain visible in the selector but cannot be confirmed.
- The confirmed HOME deck becomes Player 1's initial SETUP deck. Partner and
  incident labels and art resolve from the saved card numbers, with both
  portrait and landscape incidents rendered using `object-fit: contain`.

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

## 2026-08-03 HOME/SETUP visual implementation decisions

- HOME and SETUP now share `PrimaryHeader`; navigation order and the premium
  game-start treatment have one owner.
- SETUP uses a centered player-versus-CPU stage. Both sides show saved deck,
  real partner/incident art, and formal card names; incident art is contained
  to support portrait and landscape cards.
- Deck selection is provisional and side-specific. Escape/cancel restores
  trigger focus; confirm updates only the requested slot.
- CPU difficulty remains non-interactive `ノーマル（固定）` until the engine
  has a real difficulty contract. Solo/observe, first player, swap, randomize,
  match-session guards, metadata, and the public BUG-274 route remain active.
- MATCH ownership is fixed at `RealMatchView` mount and cleared on unmount.
  Route cleanup reads a current-route ref so deferred SETUP failures cannot use
  a stale closure and leave human ownership or pending state behind.
- The regression test waits for real MATCH and SETUP `hashchange` tasks in
  separate React turns; manual event dispatch and same-batch false greens are
  prohibited for this lifecycle path.
