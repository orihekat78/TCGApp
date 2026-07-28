# Row 029 attempt 1 -- normal public completion

- Pair: YOU `deck-1784115404288` (black-red) vs CPU
  `deck-1784115417710` (blue-green), desktop P1. No dispatch, state injection,
  pending/state read, non-public information, or face-down-card identification.
- Result: DEFEAT, T10. YOU evidence `0/7`; CPU `7/6`; normal result screen.
  CPU MVP was `B09108` Kudo Shinichi & Hattori Heiji, contribution AP `8000`.
- Opening: kept Gin L5, Vermouth L7/L2, Akai & Gin L9, and Kir L8. The hand
  had no legal play at FILE1; passed T1. At FILE3, used Vermouth L2 (AP1000)
  rather than hold every curve piece. At FILE5 a card-selection attempt opened
  a confirmation for Vodka rather than Gin, so cancelled; no unintended play.
- Key decisions: the public forced hand-remove at T4 selected Kiriko L3,
  preserving higher-impact L5/L7/L9 bodies. At FILE7 deployed rush Vermouth
  L7 (AP6000); at FILE9 deployed Akai & Gin L9 (AP8000). Alternatives were
  low-impact Vodka/Gin or withholding pressure; selected immediate public
  board power while CPU was already at 5 evidence and then 7.
- Public opponent board escalated from Ran/Conan L2s to Ran L6, then Kudo &
  Hattori Heiji L9 and Ran L5. CPU reached 7/6 evidence; our action panel
  stayed `waiting` despite declared-target counts, so no action control was
  visibly available. This was observed UI behavior, not a confirmed mismatch.
- UI: all effects, forced removal, and result transition rendered normally.
  No blocked issue. Browser console errors `[]`.
- Verification: `git diff --check` passed. `npm run tcg:packet:build` remains
  blocked by its expected `worktree is dirty` protection while durable row
  records are being written; no cleanup was attempted.
