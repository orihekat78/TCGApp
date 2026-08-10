# Eight-participant formative study package — planned, not completed

This is an eight-participant study: five first-time participants, including at
least two with no digital-TCG experience, plus three returning participants who
used the existing UI more than once. It does **not** claim that the study has
occurred. Record
participant code, cohort, device/viewport, build/commit, date, moderator, and
consent before each session.

## Protocol

- Use the real public UI only. Start/recover at `http://127.0.0.1:5174/#setup`.
  No state injection, direct `#match`, store dispatch, devtools edits, fixtures,
  or hidden-engine mutation.
- Ask participants to think aloud. Moderator may repeat the task but not name a
  control or explain rules. Record start/end, completion, wrong turns, help,
  hesitation (>5s), error text, route, and exact participant words.
- Capture screen/video and console result only with consent. Stop on a blocking
  defect; recover through the public SETUP route and record the recovery.

## Tasks and counts

| Task | Success/count record |
| --- | --- |
| 1. Find the active deck and change it without accidentally confirming. | completion; wrong deck/confirm; cancel and focus-return observed |
| 2. Configure a human-vs-CPU match and start it. | completion time; setup errors; backtracks; route entered/exited |
| 3. Complete one legal visible decision in the live match. | decision type; attempted invalid target; prompt comprehension; presentation/Toast comprehension |
| 4. Find a card, open its details, then return to the prior task. | search/filter errors; detail-close and focus return |
| 5. Find a completed match in history and open its replay. | empty/error state if applicable; artifact load result; replay controls understood |
| 6. Change density or presentation setting and explain the visible result. | correct setting; persistence after refresh; reduced-motion preference if available |

## Evidence and triage

Log each observation as `participant/task/step/evidence/impact/repro`. P0:
cannot start, continue, recover, or avoid misleading game outcome; halt the
session path and file reproducible evidence. P1: task completes only with
moderator help, recurring wrong route/control, inaccessible focus/label, or
misunderstood public game feedback. Preserve timestamps, screenshots, and
unmodified recording references; do not infer a defect from preference alone.

## Debrief

Ask: “What felt clear?”, “Where did you expect something else?”, “What would
you change first?”, and “Would you trust the match/result/history feedback?”
Ask non-TCG participants which terms blocked progress; ask returning participants
what changed from expectation. End with observed issues, not a success claim.
