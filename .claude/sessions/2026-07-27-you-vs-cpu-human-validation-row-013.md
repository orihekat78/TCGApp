# row 013: 警察・標準 vs 黒赤デッキ

Status: clean, desktop. CPU win, T10. Console errors: 0.

- Retained mixed public opening: Yokomizo Lv4, Megure Lv5 x2, Yokomizo Lv8 x2, and Takagi Lv2. At FILE1 all six cards visibly showed level gating; no legal play existed.
- Public board: YOU evidence 0/7, FILE1, partner Chihaya LP1. CPU evidence 0/6, FILE0, partner Gin LP1. No private information opened or used.
- T2: played Takagi Lv2 (only legal card at FILE3). CPU then reached evidence 3/6 with Bourbon and Kiriko visible.
- T3: played Megure Lv5 (FILE5). Selected Action, Megure, then the opponent incident; confirmation exposed the action target. Result: YOUR evidence 0->1, CPU 3->2; source `action-case-gain`, owner/chooser YOU, target CPU incident. The optional `charModifyAP` prompt was declined because the UI did not state its effect.
- CPU T3 attacked Megure with Gin (AP5000). Guarded with Takagi to preserve the AP5000 character; the sole +1000 cut-in could not change the matchup and was passed. Result: Takagi removed, YOU LP 2->1.
- T4: mandatory `effect:mill` required a hand removal; removed the visible lower-value Yokomizo Lv4. Played Megure Lv5, repeated the incident action (YOU 1->2, CPU 4->3), declined the same optional effect, then used Assist after its dialog disclosed FILE7->8 and no same-turn solve.
- T5: CPU had 6/6 evidence. Played Yokomizo Lv8. CPU-owned optional `sceneRemove` prompt (source `[D11015#23]`, chooser YOU, target side YOU) was declined; then activated Yokomizo `[D11005#25:a2]` taunt to force an opponent action target. CPU solved its incident and won at T10, 6/6 vs 2/7.
- UI review: initial action selection labels only valid sources; the opponent incident title itself (not its evidence button) was the actionable target. Evidence button opens a clearly labelled private-card modal and kept all cards face-down. Action confirmation, guard dialog, cut-in eligibility and Assist consequence were clear. The optional `charModifyAP` picker says only "apply effect" and forces a conservative decline; improve it by displaying source/ability/effect/target side in the prompt.
