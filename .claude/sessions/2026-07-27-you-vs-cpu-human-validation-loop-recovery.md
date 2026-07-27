# YOU vs CPU validation loop recovery

## Current checkpoint (2026-07-27)

- Rows 001--025 are complete; row 025 is `clean-public-seed-unverifiable`.
- Row 026 is the next queued row, but the campaign is deliberately paused
  before it. First create the separate Conan TCG expert-play method described
  in `2026-07-27-conan-tcg-play-method-next-task-prompt.md`.
- BUG-272, BUG-273, and BUG-274 fixed three input-stop paths. Focused 42 UI
  tests and `npm run typecheck` passed. The exact live-browser Escape-cancel
  check remains pending because no controllable browser tab was available; it
  is not represented as a campaign rerun or a completed browser check.

Use this guard before starting a row:

```powershell
npm run check:you-vs-cpu-loop
```

The command reads the authoritative CSV and returns only its first non-`clean*`
row. Never advance to a later row from a failed or blocked current row.
After each browser/runtime failure, record it before retrying:

```powershell
npm run check:you-vs-cpu-loop -- --record-runtime-failure
```

The counter is persisted in `.claude/sessions/2026-07-27-you-vs-cpu-human-validation-loop-state.json` and resets automatically when the CSV advances to a new row.
After a required fresh browser has visibly reached Setup, clear that row's failure
counter before configuring decks:

```powershell
npm run check:you-vs-cpu-loop -- --record-browser-recovery
```

## Recovery contract

1. `resume-current-row`: continue that exact row only after confirming visible
   public UI state. Re-check the board after each CPU action/effect.
2. After two consecutive runtime failures, `open-fresh-browser` is mandatory:
   create a new browser tab/window and navigate first to the emitted `setupUrl`.
   Do not recover by opening `#match` directly.
3. Re-select the emitted YOU/CPU decks and viewport in Setup. Record the next
   attempt file before play; public Setup has no seed control/display, so do
   not claim seed equality.
4. If a UI/action failure recurs, retain the same row, append public evidence,
   investigate and fix by TDD, then restart the same pairing through Setup.
5. Only write `clean*` after a public result and required UI checks. Reset the
   consecutive-failure count to zero only then.

The guard never controls gameplay. All card, target, optional-effect, cut-in,
and end-turn choices remain visible-UI decisions; dispatch, state injection,
private state, and direct `#match` recovery are prohibited.
