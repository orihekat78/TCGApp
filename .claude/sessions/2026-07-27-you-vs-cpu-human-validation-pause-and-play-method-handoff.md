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

Resume row 026 only after the baseline passes its ex-ante validation protocol,
the Conan rule-version conflict is resolved, and a clean committed runtime
packet is frozen. Keep campaign execution public-UI only; begin at `#setup`;
reopen a browser only after two consecutive runtime connection failures.

## Superseding resume gate

The evidence-based method now means both
`2026-07-27-tcg-expert-knowledge-plan.md` and
`2026-07-27-conan-expert-runtime-resume-plan.md`, including their packet gate.
The method draft is input, not proof of expert play and not authorization to
play row 026.

The exact live-browser Escape cancellation for BUG-274 remains mandatory.
It cannot be waived by focused Vitest or typecheck. Before row 026, freeze a
validated-source packet, run `conan-verify`, then obtain explicit user approval.
