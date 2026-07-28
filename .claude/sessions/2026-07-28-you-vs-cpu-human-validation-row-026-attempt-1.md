# Row 026 attempt 1 -- in progress

- Pair: YOU `deck-1784115364915` (緑アグロ) vs CPU `deck-1785077234307`
  (黒カットイン), desktop P1 first. Entry used only public `#setup`; no direct
  `#match`, dispatch, state/pending read, injection, or hidden-card inspection.
- Resume Gate: clean branch `codex/row026-gate-prep` at `84b6769c`; fresh
  `npm run tcg:packet:build` passed with row-026 public-UI-only packet.
- Mulligan: kept the visible opening hand. It had a playable Lv1 event and
  future Lv2 characters; redraw would exchange known development options for
  unknown cards without an immediate board constraint.

## Public decisions so far

- T1: no visible legal character (FILE 1); passed the Lv1 event because there
  was no board or action to improve. Alternative: spend `御守り`; rejected for
  no visible immediate conversion. Result: normal end confirmation, no stop.
- CPU T1: publicly resolved to 1 evidence, FILE 2, and one sleeping
  `バーボン` (AP 1000 / LP 1) in its scene.
- T2: used visible `服部平次` Lv2 (B05036, AP 1000 / LP 1) after FILE reached
  3. Alternative: `遠山和葉` Lv2 (same visible AP/LP) or wait; selected Heiji
  to establish a named board body before the CPU extends. Public confirmation
  completed; own scene now has Heiji, hand is 6, and the one hand-use action is
  spent.

## Restart point

- Status: `in-progress`; do not alter worklist row 026 until normal result or
  a public UI/rule stop. T2 ended normally after action candidates remained 0;
  CPU then advanced to evidence 3/6 and FILE 4. Current state: YOUR T3 MAIN,
  own Heiji AP 1000/LP 1, CPU Bourbon AP 1000/LP 1 asleep, own FILE 5,
  evidence 0/7 vs 3/6, 7 visible hand cards, no pending/modal.
- Next public action: compare visible Lv5 `沖田総司` AP5000/LP0 against Lv5
  `服部平次` AP4000/LP1; choose a legal development card from the hand tray,
  then re-check action candidates. CPU is ahead on the visible evidence clock,
  so do not spend `御守り` unless its public text creates an immediate board or
  evidence conversion.

## T3--T5 log

- T3: used `服部平次` Lv5 (AP4000/LP1). `沖田総司` Lv5 was AP5000/LP0, but
  AP4000 already exceeded the visible sleeping Bourbon AP1000 while LP1 and
  retaining a 5000 attacker gave the better future line. Result: scene 2/5;
  action candidates stayed 0, then normal end confirmation.
- CPU T3: publicly reached evidence 4/6, FILE 7 and resolution chapter;
  played `カルバドス` AP6000/LP0 and removed Bourbon. Its visible declaration
  required one of our hand cards to be removed. Chose `遠山和葉` Lv2
  AP1000/LP1 as the lowest immediate body; retained both 5000 attackers,
  Heiji Lv7 and `御守り`. Result: normal UI selection and own remove count 2.
- T4: used `服部平次` Lv7 (AP6000/LP1, rapid) to match Calvados. Alternative:
  one of the 5000/LP0 Okitas or `御守り`; rejected because the public board
  had a 6000 threat and the event detail did not expose a usable immediate
  conversion. Action candidates remained 0; normal end confirmation.
- CPU T4: publicly advanced to evidence 5/6 and played `ジン` AP8000/LP2.
- T5: opened public `御守り` detail; the UI exposed only image/code `B04026`,
  not its effect text. Used `沖田総司` Lv5 (AP5000/LP0, rapid) rather than
  spend an effect with no visible result. Result: scene 4/5, hand 4, action
  candidates 0. UI finding: public card detail lacks accessible rules text.

## Restart point (updated)

- Status: `in-progress`; worklist row 026 remains unchanged. Current state:
  YOUR T5 MAIN after Okita, evidence 0/7 vs CPU 5/6, own FILE 9, own scene
  Heiji 1000/1, Heiji 4000/1, Heiji 6000/1, Okita 5000/0; CPU scene Bourbon
  1000/1, Calvados 6000/0, Gin 8000/2. Four visible hand cards remain;
  action candidates 0 and no modal/pending surface. Next: normal end turn,
  observe CPU's final evidence/incident path, record result or a public stop.

## Outcome

- Normal public result screen: `DEFEAT`; YOU lost and CPU won in 12 turns.
  The result view showed YOU 0/7 and CPU 2/6 after the prior public board
  showed CPU 8/6. No post-result operation was made. The separate row-026
  completion record and worklist transition already present remain authoritative.
- Verification: browser console error log was empty. `npm run tcg:packet:build`
  refused to build because the worktree was already dirty; no dirty files were
  reverted or overwritten.
