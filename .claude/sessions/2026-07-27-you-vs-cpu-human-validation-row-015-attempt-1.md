# Row 015 attempt 1: police vs fast

## Status

- Pair: YOU `sample-d11` (police) vs CPU `deck-1784115431945` (fast), desktop.
- Incomplete. The UI left the active match after an attempted action-cancel shortcut.
- Worklist row 015 remains `queued`; rerun it from match setup. Do not treat this as a result.

## Public decisions and results

1. Opening hand: Yokomizo Lv4, Yokomizo Lv7, Chihaya Lv8, Yokomizo Lv4, Sato Lv2. Kept: no public color/legality problem.
2. T1 FILE1: all six visible hand cards exceeded FILE. Ended only after checking legal actions.
3. CPU T1: publicly played Miike Naeko AP1000; CPU evidence 1/6, scene 1, FILE2.
4. T2 FILE3: Sato Lv2 and Oe Lv3 legal. Played Oe Lv3/AP3000 to establish board advantage. Source `hand play`, owner/chooser YOU, changed side YOU scene.
5. Action flow: UI let only partner Chihaya be an action source. Target selection remained open after clicking Miike, which had no public sleep/stand label. `Esc` then routed to HOME rather than cancelling the selection.

## UI review / follow-up

- Positive: exact disabled reasons, FILE threshold and hand-use limit are visible.
- Review, not a confirmed BUG: action can enter a target-selection state despite no visibly eligible target, and no visible cancel control was found. `Esc` abandoned the current match. Need reproduce and inspect routing/key handlers, ActionContext/pending/log, and rules before filing a BUG.
- No console evidence captured after the HOME transition. No private opponent information inspected.
- Rerun recovery: a visible "start investigation" activation went to HISTORY; direct public navigation to `#match` then remained at `対戦を準備しています…` for over five seconds. This is insufficient to diagnose a rules/UI BUG, but prevents restarting row 015 until the setup flow is restored.
