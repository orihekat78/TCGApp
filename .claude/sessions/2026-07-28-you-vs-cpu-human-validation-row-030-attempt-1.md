# Row 030 attempt 1 -- normal public completion

- Pair: YOU `deck-1784115404288` (black-red) vs CPU
  `deck-1784115431945` (shippu), desktop P1. No prohibited state/hidden-info
  access was used.
- Result: DEFEAT T10; YOU evidence `0/7`, CPU `6/6`. CPU MVP: Hagiwara
  Chihaya & Hagiwara Kenji `B09070`, contribution AP `8000`.
- Kept a low-curve Bourbon L2, Gin L2, and high-impact L7/L8/L9 cards.
  T1 had no legal play. At FILE3 played Bourbon L2 (AP1000) to establish a
  body; at FILE5 held the remaining L2 and awaited FILE7 pressure.
- At T4 the public forced hand removal selected event `Cut`, preserving the
  7--9 level bodies. At FILE7 deployed rush Vermouth L7 (AP6000); CPU later
  removed it publicly. At FILE9 deployed Akai & Gin L9 (AP8000). Alternatives
  were Gin L2 or holding the high curve; public evidence was already 4/6 then
  6/6, so immediate maximum board pressure was chosen.
- Public CPU board: Naeko L2, Yokomizo L7, then Hagiwara pair L9. The action
  area stayed `waiting` although one declared target was shown; no action
  control rendered. Observation only, not a confirmed mismatch. Normal result
  transition; no blocked issue. Browser console errors `[]`.
- Verification: `git diff --check` passed. `npm run tcg:packet:build` stopped
  at expected `worktree is dirty` protection during durable record writing;
  no cleanup was attempted.
