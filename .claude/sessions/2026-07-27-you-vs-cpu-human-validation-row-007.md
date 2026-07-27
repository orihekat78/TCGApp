# Row 007 少年探偵団・標準 vs 疾風

- Viewport: desktop. YOU=P1, CPU=P2. Opening mulligan returned three visibly high/gated cards, retaining two low cards; redraw gave 元太Lv3 and 元太Lv5.
- T1: FILE 1 made all visible cards unavailable. END was the sole legal play. CPU T1: evidence 1/6 and 高木渉 AP1000.
- T2: public legal choices were 光彦Lv2/AP1000 or 元太Lv3/AP2000. Chose 元太 for pressure, then mandatory discard selected 光彦Lv2 to preserve higher cards. CPU T2: evidence 3/6, FILE 4, 高木渉 and 松田陣平 AP3000.
- T3: FILE 5 made 元太Lv5/AP5000 legal; used it as highest visible legal AP. CPU then reached evidence 5/6 and prompted forced discard. Selected 歩美Lv4/AP4000, preserving the stronger curve. UI exposed `effect:discard`; source/ability was not publicly named. owner=CPU, chooser=YOU, target=歩美, changed side=YOU remove.
- T4: FILE 7. ConanLv8 was visibly disabled by FILE shortfall; chose ConanLv7/AP6000. CPU reached 8/6 and attacked with 萩原千速 AP8000 twice. Guarded first with 元太Lv5/AP5000 (LP0), passed with zero cut-in candidates, then guarded second with ConanLv7/AP6000 (LP1) and again passed with zero cut-in candidates. The public board continued normally.
- T5: FILE 9 enabled ConanLv8/AP7000; used it. Its explicit optional discard prompt was declined (`リムーブしない`) because no public benefit was shown. source=own hand card; owner/chooser=YOU; optional target=none; changed side=YOU field.
- Result after CPU resolution: DEFEAT T10; YOU 0/7, CPU 8/6. CPU resolved the case normally.
- UI review: turn, phase, disabled FILE reason, forced discard, guard, cut-in count/pass, and optional discard were visible. Card-action surface remains visually distinct from magnifier. No overlap, pointer interception, unresolved modal, or public-information leak observed.
- Evidence: console errors 0; pointer interception 0; max one modal; result showed no pending/resume/ActionContext residue. No rules-backed bug.
