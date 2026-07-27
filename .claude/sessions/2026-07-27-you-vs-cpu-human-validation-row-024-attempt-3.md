# Row 024 attempt 3 — browser recovery evidence

- Pair: YOU `deck-1784115364915` (緑アグロ) vs CPU
  `deck-1784115445284` (デッキ破壊), desktop P1.
- Recovery entry: a fresh in-app browser tab reached the public
  `http://localhost:5174/#setup` screen. The public Setup UI listed both deck
  controls and the expected deck options.
- Public action: P1 was changed to 緑アグロ and P2 to デッキ破壊 through the two
  visible Setup comboboxes. No game was started, and no app state, dispatch,
  private card, or direct `#match` access was used.
- Block: subsequent public-DOM verification and a later fresh-tab creation both
  stopped in the browser-control channel with a syntax error before any game UI
  action. This is external validation-browser transport evidence, not a game
  rule/UI BUG.
- Guard state: row 024 remains the first non-clean CSV row; consecutive runtime
  failures are `2`, so the next recovery must open a fresh browser at `#setup`.
- Decision: do not advance to row 025. Continue with row 024 only after browser
  control becomes responsive; re-check the visible Setup board before starting.

## Continued attempt outcome

- The recovered public UI run reached a result: CPU resolved its incident at
  8/6 evidence; the visible result was `YOU LOSE` / `事件解決!`.
- No private state, direct dispatch, or non-UI control was used. CPU actions
  and each visible effect transition were re-observed before the next decision.
- Player-policy failure: Next Hint was used before evaluating the normal hand
  play. The public UI then showed `ネクストヒント実行後は手札を使用できません`.
- Result: `rerun-required-player-policy`, not a product BUG. The same pair must
  restart from public `#setup`; row 025 remains blocked from advancement.

## Same-pair replay: clean

- Restarted the same pairing from public Setup UI and completed a full public-UI
  game: `YOU WIN` at 後攻5ターン目. No dispatch, state injection, private-state
  read, or direct match-route recovery was used.
- Player decisions were board-led: normal hand use preceded Next Hint; Next Hint
  was used only after evidence reached 6/6 and the CPU had reached 6/7, to add a
  disposable guard. Each CPU action/effect and every optional choice was
  rechecked on the visible board.
- Rule/UI observations confirmed during the replay: named characters could not
  be chosen for reasoning; incident resolution became executable only with the
  partner active; Action was not attempted while the attacker was named; guards
  and the one available cut-in were selected from visible prompts.
- Decisive sequence: preserved ヘビ男 with 遠山和葉Lv2 as guard, used the
  available cut-in, completed its mandatory visible discard with the duplicate
  ヘビ男, then used 事件解決 with evidence 6/6 and an active partner.
- Result: row 024 is `clean`. The first remaining row is 025.
