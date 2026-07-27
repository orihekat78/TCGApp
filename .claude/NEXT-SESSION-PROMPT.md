# Next Task: Conan TCG expert-play method

Use the ready-to-paste task brief:
`.claude/sessions/2026-07-27-conan-tcg-play-method-next-task-prompt.md`.

## Separate campaign checkpoint

- The YOU-vs-CPU human validation campaign is intentionally paused after row
  025. Rows 001--025 are complete; row 026 is the next queued row.
- Do not resume row 026 as a substitute for the play-method task. First make
  the expert method explicit and evidence-based, then decide the restart gate.
- BUG-272, BUG-273, and BUG-274 fixed reported input-stop paths. Focused 42 UI
  tests and `npm run typecheck` passed. The exact live-browser Escape-cancel
  regression remains pending because no controllable browser tab was available.
- When the campaign resumes, start through `#setup`, use public UI/public
  information only, and open a new browser only after two consecutive runtime
  connection failures. See the loop recovery record for the exact protocol.

## Records

- Campaign plan:
  `.claude/specs/plans/2026-07-27-you-vs-cpu-human-validation-plan.md`
- Worklist:
  `.claude/sessions/2026-07-27-you-vs-cpu-human-validation-worklist.csv`
- Pause handoff:
  `.claude/sessions/2026-07-27-you-vs-cpu-human-validation-pause-and-play-method-handoff.md`
- Recovery state:
  `.claude/sessions/2026-07-27-you-vs-cpu-human-validation-loop-recovery.md`
