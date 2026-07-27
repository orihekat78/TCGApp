# row 009 — 少年探偵団・標準 vs 白黄前髪

Status: clean, desktop. Restarted from setup after the previously handed-off tab had closed; latest run completed at T10.

## Latest restart (public UI only)

- T1: kept one Ayumi and mulliganed Mitsuhiko, Haibara, duplicate Ayumi, and Ran. All six cards after mulligan were disabled at FILE 1, so ended. CPU: Kid Lv2/AP1000/LP1, evidence 1/6, FILE 2.
- T2: YOU FILE 3, used Ran Lv3/AP2000. Clicking the own field card did not enter the displayed action-selection flow. CPU: evidence 3/6, FILE 4, remove 1.
- T3: YOU FILE 5, used Ayumi Lv4/AP4000. Mandatory source `hand [Ayumi]`, ability `evidenceToHand`, owner/chooser YOU: selected the sole own facedown evidence; returned Ran Lv3; mandatory `discard` then removed Mitsuhiko Lv2/AP1000. CPU reached resolution chapter, evidence 4/6, field Kid Lv2 + Robot Kaito Lv5.
- T4: CPU declaration required chooser YOU to discard. Removed Genta Lv3/AP2000. YOU used Haibara Lv7/AP6000; no unresolved effect. CPU reached evidence 6/6, then displayed an opponent-deck reveal during its resolving action.
- T5: source `hand [group]`, ability optional `charSetTurnEffect`, owner/chooser YOU: used Group Lv8/AP8000/LP2 and chose `選ばない` for the unexplained optional remove-stack UI. YOU had no legal visible reasoning/action control; ended. CPU won at T10: YOU evidence 0/7, CPU 6/6.

## UI/rules candidate resolved

- During CPU resolution, UI status `effect:deckRevealUntil` and a visible list exposed 11 ordered opponent-deck cards. The information was not used for any YOU decision. Source/action match: B09109P a1 explicitly declares `deckRevealUntil` with `visibility: public`, `viewer: all`, and `player: self`; CPU status identified `B09109P`. This is authorized public disclosure by the card ability, not a BUG.

- T1: initial public hand had Conan No.0091, event No.0498, Ayumi No.0491, Mitsuhiko No.0493, and group No.0264. Returned all except Ayumi; low immediate curve was preferred. New public hand: Ayumi Lv2 x2, Haibara Lv7, Mitsuhiko Lv6, Conan Lv7, group Lv8. No legal T1 play at FILE 1; ended.
- CPU T1: public result: Kid Lv2/AP1000/LP1 entered, evidence 1/6, FILE 2. Status source `hand [B04033]`.
- T2: YOU FILE 3. Played Ran Lv3/AP2000 rather than Ayumi Lv2/AP1000. Result: field Ran, no unresolved choice.
- CPU T2: public result: second Kid Lv2/AP1000/LP1 entered, evidence 3/6, FILE 4; status `推理 [B04033#1]`.
- T3: YOU FILE 5. Played Ayumi Lv4/AP4000; source `hand [Ayumi]`, owner YOU. Result: evidence 1/7 and mandatory `evidenceToHand [Mitsuhiko]` (chooser YOU); selected the sole facedown own evidence by position, then mandatory `discard` (chooser YOU). Discarded a duplicate Ayumi Lv2/AP1000. Result: YOU remove 1, hand 6, evidence 0/7.

Public board at handoff: YOU field Ran Lv3 AP2000 LP1 + Ayumi Lv4 AP4000 LP1; FILE 5, evidence 0/7, partner Conan LP1, remove Ayumi Lv2. CPU field Kid Lv2 AP1000 LP1 x2; FILE 4, evidence 3/6, partner Kid LP1. Current turn remains YOU T3, main, hand use consumed; turn end available.

UI notes: home-page `推 理 開 始` routed to History instead of Setup in this live session; navigated to the public `#setup` route only to recover the session, then used setup UI. Card text clicks expand a hand but the expanded card has no accessible role/button; selecting a field card during a mandatory hand choice produced no visible feedback. Not a confirmed BUG yet.
