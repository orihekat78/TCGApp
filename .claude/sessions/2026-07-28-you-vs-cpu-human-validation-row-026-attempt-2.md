# Row 026 attempt 2 -- public UI completion

- Pair: YOU `deck-1784115364915` (green aggro) vs CPU
  `deck-1785077234307` (black cut-in), desktop P1. Started from public
  `#setup`; no direct `#match`, dispatch, injection, pending/state read, or
  face-down identity inspection.
- Seed: Setup and Match exposed no seed. Exact-seed identity is therefore not
  verifiable on the allowed surface.

## Board-led play evidence

- T1: kept the visible hand and deployed the legal Lv2 Heiji. T2 used public
  Omamori: chose the revealed Lv2 Heiji, set the remaining public cards' deck-
  bottom order, then deployed it through the visible forced choice.
- T3: FILE 6 enabled the visible Lv5 Heiji; it was deployed. No action target
  was shown while opposing characters were active, so no unsupported action
  was attempted.
- T4: CPU's public effect required one hand discard; one redundant Lv7 Heiji
  was selected. The remaining Lv7 Heiji was deployed. T5 used the visible
  optional Lv6 event; its public three-card remove choice then returned Okita
  Soji (AP 5000) from the visible remove area.
- CPU transitions were re-read after each completed turn. No UI stop or rule
  mismatch occurred. Browser console errors: none.

## Outcome and handoff

- Normal public result screen: `DEFEAT`; 11 turns. YOU evidence 0/6, CPU
  evidence 3/7 on the result summary.
- Row 026 status: `clean-public-seed-unverifiable`. Completion means the
  public-UI match completed, not that YOU won.
- Next row: 027, `deck-1784115364915` vs `deck-1785077473170`, desktop. Start
  it from public `#setup`; do not use direct match recovery.
