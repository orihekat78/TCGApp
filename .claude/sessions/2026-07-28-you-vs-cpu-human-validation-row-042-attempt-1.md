# YOU-vs-CPU row 042 attempt 1

- Pairing: `deck-1784115431945` (疾風) vs `deck-1784115445284` (デッキ破壊), desktop public UI.
- Result: LOSS, T12. Self evidence 0/7; CPU evidence 6/6. CPU MVP: 赤井秀一&ジン (B09110P, AP 8000).
- Used 三池苗子 L2, 松田陣平 L4/L6, and 萩原千速&萩原研二 L9 as public FILE thresholds became available.
- Public effects resolved: three-card deck-bottom ordering, a revealed 疾風 card selection, and the required hand discard (プライベートアイ). The L9 entry effect returned 萩原千速 from the visible remove area.
- UI recovery: the first run stalled at CPU `effect:sceneRemove` after 13 seconds with no public picker or enabled action. It was not treated as terminal: a separate setup-tab retry completed to the result screen using only public UI.
- No seed/reset control was publicly visible. Classification: `clean-public-seed-unverifiable`.
