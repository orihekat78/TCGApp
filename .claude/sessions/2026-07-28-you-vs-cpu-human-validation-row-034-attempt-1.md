# Row 034 attempt 1 -- public UI in progress

- Pair: YOU `deck-1784115404288` (black-red) vs CPU
  `deck-1785077473170` (soccer), desktop P1. Visible Setup selected the pair;
  no dispatch, injection, state/pending read, or face-down identity inspection.
- Current public mulligan hand: Gin, Vodka, Vermouth, Gin, Akai & Gin. Next:
  decide visible mulligan, then complete normal public play. No blocker.
- Kept, drew Karasuma event. Current P1 T1 FILE1, hand tray open; direct
  visible Gin-L2 title selection has not reached a use confirmation. Next:
  close tray/end turn if still unavailable, then continue. No blocker.
- Ended T1. Current P1 T2 FILE3; opponent has Naoki Uemura L2, own scene
  empty. Repeated visible Gin-L2 selection still reaches no confirmation.
  Next: deploy another visible card or end turn. UI observation retained.
- At P1 T2, visible Gin L2 and Vodka L7 card-title clicks repeatedly produce
  no use-confirmation dialog. This prevents normal legal card use while turn
  end remains available. Public UI interaction is therefore blocked; no further
  gameplay operation was performed. Resume only after the visible selection UI
  recovers; next action is re-open hand and confirm whether a use dialog appears.
- Recheck: public state remains P1 T2/FILE3 with the seven-card hand tray open,
  own scene empty, and no console errors. No game action taken after block.
- Fresh-browser recheck: previous tab was `about:blank`; used public `#setup`
  rather than direct match recovery. Setup exposes only 少年探偵団・標準, 警察・標準,
  and TEST — BUG-274 Escape, so black-red and soccer cannot be selected. The
  only console error is favicon 404. Row remains blocked; next action is wait
  for the normal user-deck options to reappear in public Setup.
- Correction: the earlier “blocked” diagnosis was wrong. At FILE1 the L2 card
  was explicitly disabled; at FILE3, I clicked the collapsed hand control
  rather than the expanded legal card. The user's in-app browser retained the
  black-red and soccer options; a separate browser context caused the false
  contrary observation.
- Restart: public Setup selected black-red vs soccer and P1. Kept the mulligan;
  T1 had no legal card, so ended. At T2 FILE3, played the now-legal Bourbon L2
  (AP1000) after visible use confirmation. Current action: close hand tray,
  end turn, and continue normal public play. Status: `in-progress`.

## Completed result

- Result: P1 YOU lost at T12. The visible result screen records `自証拠 0/7`,
  `敵証拠 7/6`, and defeat reason `必要証拠数達成`.
- Public-play record: used Bourbon L2 (AP1000), Gin L5 (AP5000), Bourbon L7
  (AP6000), Bourbon L8 (AP8000), and the visible Bourbon `【FILE6】` optional
  action-end ability to remove itself and deploy Vermouth L7 (AP6000). No
  opponent face-down card was opened or identified.
- Key decisions: at T4, actioned visible Haibara with Bourbon L7, then passed
  the available cut-in because no shown card offered a favorable response; the
  public board then showed Haibara removed and Bourbon surviving. Later guarded
  visible Kudo's AP8000 action with the expendable Bourbon L2. At T6, actioned
  Kudo with Bourbon L8, passed the cut-in, and used the shown optional effect
  to convert the expiring Bourbon into Vermouth. The result was visible Kudo
  removal and a two-character own board, but CPU already held 7/6 evidence and
  won at turn end.
- UI findings: setup selection, mulligan, hand expansion, use confirmations,
  guard, cut-in pass, optional-effect selection, and final result all worked in
  the user's in-app browser. Earlier blocked and deck-absence notes above are
  explicitly superseded by the correction; their cause was an incorrect card
  control/browser-context observation, not a public-UI blocker.
- Validation status: completed from public UI only. Seed/replay identity is not
  exposed by the allowed UI, therefore `clean-public-seed-unverifiable`.
- Next: row 035, YOU `deck-1784115417710` vs CPU same deck, desktop; begin at
  public `#setup` and select the visible pair.
