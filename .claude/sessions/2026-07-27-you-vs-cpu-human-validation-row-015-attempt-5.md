---
row: "015"
status: clean
you_deck: sample-d11
cpu_deck: deck-1784115431945
viewport: desktop
---

# Row 015 attempt 5: 警察・標準 vs 疾風

## Setup

- Fresh desktop browser tab; P1 `警察・標準` (YOU), P2 `疾風` (CPU), P1 first.
- The visible setup UI exposes no seed control or seed value; seed is recorded
  as unverifiable and was not claimed fixed.
- Only public UI and visible board/log information were used.

## Play evidence

- T1–T3: used partner reasoning when it was the visible legal action; no card
  play or action target was visibly available.
- CPU turns: after each observed card/effect sequence the board was rechecked.
  The former `sceneEnter` / `charModifyAP` route returned control normally.
- T4: public effect required a hand removal; chose the visible low-AP card.
  Then used 萩原千速 to action the visible opposing 萩原千速 and passed cut-in
  because no positive public basis to spend a card was shown.
- Final visible result: `YOU LOSE / 事件解決!`.

## Result

- clean. BUG-270 did not recur; no opponent-turn overlay stall.
- Focused regression evidence: 9 tests passed (CPU pick/choice surface guards,
  B09075 a2, and human-pick driver path).
