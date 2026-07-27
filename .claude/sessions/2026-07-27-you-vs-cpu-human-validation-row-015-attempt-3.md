# Row 015 attempt 3: police vs fast

## Status

- Pair: YOU `sample-d11` vs CPU `deck-1784115431945` (fast).
- Desktop public Meta UI, fresh tab. Seed control was not publicly exposed, so same-seed compliance is unprovable.
- Blocked at CPU T6. Do not start row 016. Restart this same pairing from setup after the active UI fix is loaded.

## Public UI evidence

1. T1--T4 resolved through visible controls: hand use, reasoning, next hint, case actions, target confirmation, and optional decisions.
2. CPU `sceneSetState:awaiting-pick` resolved automatically on T3. CPU later used `sceneRemove`; own field changed and CPU turn presented a mandatory human hand selection.
3. Log showed `T9 自 効果: 手札選択待ち`. No separate modal appeared, but the visible hand itself was the active selection surface. Selecting one visible Lv2 card removed it, changed own remove `2 -> 3`, closed the hand picker, and returned control. This was not a CPU stall.
4. YOU then used visible `横溝重悟` (Lv7/AP6000). Its public detail states an on-enter choice of one character for AP -1000 until turn end. A visible opposing character was selected and the log/toast recorded `effect:charModifyAP`.

## Current board checkpoint

- YOU evidence `5/7`, FILE `7`, scene `5/5`, remove `3`.
- CPU evidence `2/6`, FILE `7`, remove `7`.
- No console/state injection, dispatch, or private-state inspection used.

## Block evidence

1. CPU T6 used B09075 a2. The public log recorded `effect:charModifyAP:awaiting-pick`, followed by `effect:charModifyAP` with AP `+2000/turn`.
2. Even after the AP result appeared, the visible UI remained on `相手のターン処理中` for more than 7 seconds. No human selection surface was visible.
3. The worktree already contains an uncommitted targeted CPU-choice drain fix and regression test. Focused Vitest passed 6 tests. The active browser session may therefore have been created before that fix was loaded.
