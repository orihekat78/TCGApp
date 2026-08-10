# Session memory

## Active UI quality program

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

## Latest verified evidence

- Vitest: 923 files / 7552 tests passed; 5 files / 197 tests skipped; 0 failed.
- Typecheck, lint, production build, and meta build passed.
- Public human-vs-CPU full match: 2/2 passed; MATCH visual gates: 12/12 passed.
- Presentation Skip review: Critical / Important 0.

## Resume order

- Complete code-wide adversarial, engine, Visual Craft, UX, visual QA, and test reviews.
- Fix every Critical / Important finding and rerun affected plus full gates.
- Finalize `.claude/bugs/BUG-277+`, run `npm run docs`, `npm run docs:check`,
  and `git diff --check`; never hand-edit `.claude/auto/**`.
- The real eight-person formative study is external and remains unexecuted.
- Do not commit, push, merge, or publish without an explicit user request.
- Full session record: `.claude/sessions/2026-08-09-ui-quality-causal-public-match.md`.
