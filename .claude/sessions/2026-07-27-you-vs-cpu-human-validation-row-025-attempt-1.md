# Row 025 attempt 1 — public UI completion

- Pair: YOU `deck-1784115364915` (緑アグロ) vs CPU
  `deck-1785068468834` (白黄前髪), desktop P1.
- Entry: public `http://localhost:5174/#setup` only. The visible Setup UI
  selected the pair and started the match. No direct `#match` recovery,
  dispatch, state injection, or private-card/state read was used.
- Seed: the public Setup/Match UI exposed no seed value. Thus exact-seed
  identity is not verifiable from the allowed surface.

## Board-led play evidence

- T3/T4: 沖田総司の突撃 and 服部平次の迅速 were used only after their public
  keyword badges and the current action candidates were checked. A cut-in was
  spent only when it converted a 6000-vs-6000 action into removal of the
  opposing 6000 怪盗キッド; the earlier unneeded cut-in was passed.
- T4/T5: 相手パートナー was visibly `アシスト中`; no unsupported claim that
  the opponent could resolve in that same turn was made. 自分は active
  遠山和葉で推理し、証拠を 2→3→4→5 と進めた。
- T6: public hand use of `平次の洞察力` presented “現場のキャラを1枚選んで
  リムーブしてください”. The visible 7000 怪盗キッド was chosen. A following
  optional selection had no candidates, so visible `選ばない` completed it.
- CPU plays/effects were re-read after every transition. Next Hint was not used:
  it would move the top FILE card (face-down in this position) into our hand and permit an optional
  legal hand use, while consuming FILE and disabling the normal hand-use action
  for that turn. The visible hand already supplied the chosen board action.

## Outcome

- Normal result screen: `DEFEAT` / `必要証拠数達成`.
- CPU: 7/6 evidence; YOU: 5/7 evidence; 12 turns.
- The match reached its normal result screen with no UI stop. Row 025 is
  `clean-public-seed-unverifiable`; this records execution quality, not a win.
- Row 026 was not started. The campaign is paused here per user direction.

## Follow-up boundary

- Before resuming the campaign, start a new task for the gameplay-decision
  baseline and the earlier declaration-target input-stop investigation:
  reproduce through public UI, then TDD, BUG documentation if confirmed, and
  horizontal investigation.
