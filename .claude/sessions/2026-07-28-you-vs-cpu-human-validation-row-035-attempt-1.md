# Row 035 attempt 1 -- public UI in progress

- Pair: YOU `deck-1784115417710` (blue-green) vs CPU same deck, desktop P1.
  Selected visibly in public Setup; no dispatch, injection, state/pending read,
  or face-down identity inspection.
- Current public mulligan: Mouri Kogoro No.0094, Kudo Shinichi No.0411,
  Hondo Eisuke No.0950, Hattori Heiji No.0965, Kudo Shinichi No.0735.
  Next action: decide the visible mulligan, then normal public play.
- Kept the visible opening hand. T1 had no legal card and ended. At T2 FILE3,
  played Kudo Shinichi L2 (AP1000) after visible confirmation. At T3 FILE5,
  selected Mouri Kogoro L5 (AP5000); the public `手札の使用` confirmation dialog
  is open. CPU has visible evidence 2/6; YOU has 0/7. No blocker.
- Exact restart action: in the already open `手札の使用` dialog, press `使用`,
  then continue only through visible UI. Do not inspect opponent face-down
  cards or use any state/dispatch/pending shortcut.

## Blocked -- public UI action selection

- Continued through public UI: confirmed Mouri Kogoro L5 (AP5000), then at T4
  FILE7 discarded the visible Mouri Ran L2 in response to the visible forced
  discard prompt and played Hondo Eisuke L7 (AP6000). CPU evidence was 2/6;
  YOU evidence was 0/7.
- Important decision: with only a visible opposing Mouri Ran AP6000 and no
  shown sleep/stan target, I declined to trade the active AP5000 Mouri. Hondo
  could not be selected as an action source because it had just entered.
- Public UI failure: the Action control nevertheless entered source selection.
  After choosing Mouri, it entered `アクション対象 の対象を選択してください`, but
  no eligible opponent target was exposed; the public UI exposed no cancel
  control and `ターン終了` remained disabled. Attempting the visible opponent
  card did not advance the state. No further action was performed.
- Status: `blocked-public-ui-action-selection`. Resume only after the visible
  UI exposes an action cancel or a legal target; exact next operation is use
  that public control, then end the turn. Do not use any state shortcut.
- Re-audit: state is unchanged at P1 T4; status remains `アクション対象 の対象を
  選択してください`, `ターン終了` is disabled, no visible cancellation control
  exists, and browser console errors are empty. No operation was performed.

## Recovery and completion

- The prior blocked classification was incorrect. The public Escape key cancelled
  the visible action picker and restored the enabled turn-end control; no hidden
  state or internal API was used.
- Restarted through the public `#setup` screen with the same visible deck pair
  and P1. The replacement public match completed at turn 12: YOU lost,
  evidence 0/7; CPU won, evidence 8/6.
- Important decisions: played Mouri Ran L5 at FILE5; declined Eri's optional
  enter effect when no visible eligible target was available; played Eri L7 and
  Kudo Shinichi & Hattori Heiji L9; actioned Eri into the visible sleeping
  Quantum and passed cut-in; guarded CPU's Mouri Ran with the visible L9.
- UI finding: source and target labels are emitted as adjacent visible text,
  so the marker must be associated with the immediately preceding card. The
  action selection is recoverable with public Escape; it is not terminal.
- Status: clean-public-seed-unverifiable. The setup UI exposes no seed control.
