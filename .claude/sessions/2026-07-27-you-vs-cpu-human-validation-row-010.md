# row 010: 少年探偵団・標準 vs 黒カットイン

Status: clean, desktop. Public-UI restart completed at T12; CPU win, YOU 0/7 and CPU 3/6 on the result screen. Console errors: 0.

## Public decisions and results

- Mulligan: kept Mitu Lv6 and Genta Lv5; returned Conan Lv7, event No.0498, and Ran Lv3 seeking a usable early curve. T1 FILE1: every card disabled, so ended.
- CPU T1: evidence 1/6, FILE2, partner asleep. T2 FILE3: played Ran Lv3/AP2000 (only legal low-cost body); result field Ran. CPU then had evidence 2/6, FILE4, and Canti Lv3/AP2000.
- T3 FILE5: played Genta Lv5/AP5000. Opponent had Canti and sleeping partner. Selecting Genta on the field did not expose the displayed action-selection control, so no action was available through the public UI. CPU reached resolution, evidence 3/6; source status `hand [B07098]` then `effect:charModifyAP [B07098#2]`.
- T4: mandatory discard chooser YOU, source CPU resolution: removed duplicate Genta LP0. Played Conan Lv7/AP6000/LP1. Result: field Conan; CPU later removed it and advanced to evidence 5/6.
- T5: inspected public card detail for event `蘭の一撃`, but its image-only detail gave no readable effect text. Played Haibara Lv7/AP6000/LP1. CPU advanced its field to Canti, Bourbon, and Rum.
- T6: played Conan Lv8/AP7000/LP2. Its optional discard prompt showed `リムーブしない`; chose decline. CPU completed the game; result screen reported defeat at T12.

## Context and UI review

- Public source/ability information visible in status: CPU `B07098#2` / `charModifyAP`; own forced hand removal was resolved immediately by a visible hand selection. No pending stack remained at result.
- Board, FILE count, evidence, hand-use limit, and disabled reasons were visible. Card bodies in the expanded hand were generic elements rather than accessible buttons; click works, but the visual/action affordance is weak.
- The action panel says to select an attacker and a sleeping/stunned target, but no visible actionable control appeared after selecting own field Genta. Recorded as UX observation only; no rules/log evidence yet for a BUG.
- Opponent facedown FILE cards and hand contents were never opened or used. Only public counts, field cards, status, and required own choices informed decisions.
