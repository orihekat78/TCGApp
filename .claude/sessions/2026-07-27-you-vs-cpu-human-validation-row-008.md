# Row 008 少年探偵団・標準 vs デッキ破壊

- Viewport: desktop. YOU=P1, CPU=P2. Mulligan returned visible high/gated 阿笠Lv5, 歩美Lv4, ConanLv7, retaining two RanLv3; redraw supplied 光彦Lv2, event Lv6, 元太Lv5.
- T1: FILE 1 made all visible cards unavailable, so END was the sole legal action. CPU T1: evidence 1/6, ジン AP1000.
- T2 FILE3: legal RanLv3/AP2000 and 光彦Lv2/AP1000; chose Ran. CPU T2: evidence 3/6, バーボン AP1000. Its public resolution added 灰原哀 to YOU remove with no chooser UI; status=`[B09099]`, source=CPU play, changed side=YOU remove.
- T3 FILE5: chose 阿笠Lv5/AP5000 with LP1 over equal-AP 元太Lv5/LP0. CPU reached 解決編 5/6 with ベルモットAP6000. Public forced discard selected lowest 歩美Lv2/AP1000; status=`effect:evidenceFlip`, source=`[B03067P]`, owner=CPU, chooser=YOU, changed side=YOU remove.
- T4 FILE7: used 元太Lv5/AP5000 as the strongest certain field addition. CPU then reached 8/6 and added 赤井秀一&ジンAP8000; public remove counts remained visible.
- T5 FILE9: used event `「あら…頼もしいじゃない…」` because the board was behind. Public effect opened own remove and required a revival choice; chose 阿笠Lv5/LP1 over 元太Lv5/LP0 and 歩美Lv4. source=own hand event, owner/chooser=YOU, target=阿笠, changed side=YOU remove→field.
- Follow-up UI presented two optional field-target stages. Direct public clicks on both visible 阿笠 card surfaces did not select a target; the explicit `選ばない` choice was used twice. Both stages resolved, stack returned to 0, and turn end became enabled. This is an UX/accessibility observation, not a rules-backed bug.
- Result: DEFEAT T10; YOU 0/7, CPU 8/6. Console errors 0; pointer interception 0; max one modal; no pending/resume/ActionContext residue on result.
- UI review: disabled FILE reasons, hand count, forced discard, remove-to-field target list, optional skip, and CPU-processing lock were visible. Set cards remained face-down and opponent hand stayed count-only. No confirmed bug.
