# Row 019 attempt 2 — clean public rerun

- Pairing: YOU `sample-d11` (警察・標準) vs CPU `deck-1785077473170` (サッカー), desktop; YOU first, redrawなし。
- Seed: public setup UI exposes neither seed value nor seed control; `seed-unverifiable`.
- CPU/effect checkpoints: every visible CPU action and resolution was rechecked. CPU reached 7/6 evidence on turn 4, fielding 灰原哀, 赤木英雄, and 工藤新一; its 工藤 attack prompted the visible guard dialog. No public guard was available, so `ガードしない` was selected. The visible cut-in menu was inspected and passed.
- YOU decisions: turn 4 used 松田陣平 (Lv6/AP5000), actioned 灰原哀, then reasoned with partner 萩原千速. Turn 5 used 萩原千速 (Lv5/AP5000), reasoned with it, actioned 灰原哀, and passed the displayed cut-in; 灰原哀 moved to CPU remove. Assist was then used after its dialog disclosed FILE 9→10 and the turn-local no-resolution condition.
- Result: CPU resolved the case at the start of its turn 5. Final public UI: `YOU LOSE` / `事件解決!`; CPU evidence 7/6, YOU evidence 3/7.
- Clean criteria: public Meta UI only; no dispatch/state injection/private state; each card, target, optional action, cut-in, guard, and CPU resolution was decided from visible UI.
