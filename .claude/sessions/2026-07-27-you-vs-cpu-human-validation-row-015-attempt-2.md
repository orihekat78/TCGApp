# Row 015 attempt 2: police vs fast

## Status

- Pair: YOU `sample-d11` (police) vs CPU `deck-1784115431945` (fast).
- Result: `blocked-ui-stall`; row 016 must not start.
- Recreated through the public Meta UI at `http://localhost:5174/#match` on desktop.
- The UI did not expose a seed. Same-seed compliance cannot be proven without forbidden private access.

## Public UI evidence

1. YOU declined mulligan. T3 used `D11018`; T5 used `D11015`, chose no optional AP modification because the UI showed no effect amount/target, then acted on the opponent case.
2. YOU then used `D11001` against `B09076` and chose the visible `D11013` cut-in because both visible AP values were 1000. The opponent passed; the contact HIT and removed `B09076`.
3. On CPU T6, public board showed resolved `B09075` 6000 and `D11017` 3000. The log sequence was: hand use `B09075`; `effect:sceneEnter:awaiting-pick`; scene enter `D11017`; declared `B09075#4:a2`; AP +2000 to `D11017#5`; then `effect:charModifyAP:awaiting-pick`.
4. After that last log, the board and log count (24) stayed unchanged for over 5 seconds. No decision dialog appeared. All player controls were disabled and the status remained `相手のターン処理中…`.

## TDD narrowing

- Added a real-card CPU regression in `tests/ai/step-turn-human-deck-decision.test.ts`.
- `B09075#a2` leaves no pending effect-pick and no `humanPick` pause in isolated `stepTurn`; its `awaiting-pick` log is emitted even when the CPU auto-resolves it.
- Therefore the public log alone does not prove a queued picker. The remaining suspect is UI-driver continuation after this move; no production change or BUG document has been made yet.

## Restart availability check

- A new desktop public UI session was opened from HOME → 推理開始 → setup. Its deck selectors and deck editor exposed only `sample-d08` (少年探偵団・標準) and `sample-d11` (警察・標準).
- CPU `deck-1784115431945` (疾風) was absent. The UI can create or duplicate a deck, but that creates a new ID and cannot satisfy the specified rerun pair.
- The prior in-app browser tab carrying the persisted local decks is no longer controllable. Do not inject localStorage, dispatch state, or substitute another deck; row 015 remains blocked pending public-UI access to the original deck.
