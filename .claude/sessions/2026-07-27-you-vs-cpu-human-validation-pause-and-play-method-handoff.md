# YOU vs CPU pause and play-method handoff

## Campaign checkpoint

- Rows 001--025 are complete. Row 025 is
  `clean-public-seed-unverifiable`; row 026 is queued.
- The 55-row campaign is deliberately paused before row 026. Its overall
  gate, `conan-verify`, and full 55-row completion are not run.
- Runtime recovery state is `row=026`, `consecutiveRuntimeFailures=0`.

## Why pause for a separate task

The campaign asks YOU to be a human player, not a scripted legality checker.
The runs exposed a gap: choosing a legal visible control does not by itself
produce skilled decisions. Card use, reasoning, action targets, optional
effects, cut-ins, Next Hint, and incident pressure need an explicit Conan TCG
method grounded in official rules and card text.

The next task therefore builds that method first. Its role is: an experienced
Conan TCG player using this web app for the first time. It must learn the game
and the app separately, use only public UI during app verification, and explain
choices with visible information rather than private state or injected actions.

## Input-stop follow-up

- BUG-272 prevents concurrent ActionsPanel entry and end-turn while a picker is
  active.
- BUG-273 removes action sources that have no legal targets.
- BUG-274 gives multi-ability partners a labelled choice picker and lets Escape
  cancel a board-only target picker.
- Focused Vitest: 6 files / 42 passed. `npm run typecheck` passed. The exact
  live-browser Escape cancellation remains pending because no controllable tab
  was available.

## Resume condition

Resume row 026 only after the next task records an evidence-based expert-play
method and a concrete decision-log format. Keep campaign execution public-UI
only; begin at `#setup`; reopen a browser only after two consecutive runtime
connection failures.
