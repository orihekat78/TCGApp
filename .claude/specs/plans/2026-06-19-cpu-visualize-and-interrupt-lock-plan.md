# CPU逐次プレイ可視化 + 効果解決中ロック 実装計画

> 実装は superpowers:executing-plans (inline) で task ごとに進める。各 task = TDD + 独立 commit。
> 設計: [.claude/specs/2026-06-19-cpu-visualize-and-interrupt-lock-design.md](../2026-06-19-cpu-visualize-and-interrupt-lock-design.md)

**Goal:** 人間vsCPU で (1) 効果解決中に他操作を不可+解決カード可視化、(2) CPU が実盤面で1手ずつ人間ライクに着手 (速度連動)。

**Architecture:** 単一「アクティブカード」信号で盤面カードをその場ポップ。割り込みは UI 派生 `interactionLocked` で全 action 起点を塞ぐ。CPU は AI 層 `stepTurn` を per-move 駆動し FLIP で移動アニメ。骨格 (`src/engine/`) は再export のみで挙動不変。

**Tech Stack:** TypeScript / React / Zustand store / Immer / vitest / Playwright MCP。

## Global Constraints
- 骨格凍結: `src/engine/` は `effect/index.ts` の `hasPendingHumanPick` 再export のみ (挙動不変)。他は AI(`src/ai/`)/UI(`src/ui/`)。
- 検証: full vitest 減なし / smoke baseline winsA 不変 / tsc0 / lint8本 errors0 / Playwright console error 0。
- rules/05 割り込み禁止・rules/15 未解決効果準拠。commit は 1 task=1 commit (Bash heredoc, Co-Authored-By)。

---

### Task 1: 効果解決中ロック (機能・無アニメ)
**Files:** Modify `src/engine/effect/index.ts` (export `hasPendingHumanPick`) / `src/ui/components/ActionsPanel.tsx` (全項目 disabled prop) / `src/ui/components/Playmat.tsx` (`interactionLocked` 算出 + `onActionItemClick` guard)。Test: `tests/ui/interaction-lock.test.ts`。
**Interfaces:** Produces `hasPendingHumanPick(): boolean` (engine), `interactionLocked = pendingEffects.length>0 || hasPendingHumanPick()`。
- [ ] 失敗テスト: pendingEffects>0 / hasPendingHumanPick=true で `interactionLocked` true、各 ActionItem disabled、onActionItemClick が flow を呼ばない。
- [ ] 実装: 再export + 派生 flag + ActionsPanel disabled + Playmat click guard。
- [ ] vitest pass → tsc → commit。

### Task 2: アクティブカード ぴこんポップ
**Files:** Create `src/ui/hooks/useCardActivityPop.ts` + `src/ui/components/CardActivityPop.tsx` (チップ) + CSS。Modify Playmat (信号購読: `pendingEffects[top].source.uid`)。Test: `tests/ui/card-activity-pop.test.ts`。
**Interfaces:** Consumes activeCardUid+label。Produces `useCardActivityPop(uid|null, label)` → `[data-uid]` 要素に pop class 付与/除去。
- [ ] 失敗テスト: uid 指定で対象要素に `is-active-pop` 付与、null/不在 uid で no-op、150ms 後除去。
- [ ] 実装: hook + チップ component + キーフレーム。Playmat で解決中 source.uid を渡す。
- [ ] vitest pass → tsc → commit。

### Task 3: AI `stepTurn` (playTurn 分解)
**Files:** Modify `src/ai/policy.ts`。Test: `tests/ai/step-turn.test.ts`。
**Interfaces:** Produces `stepTurn(state, policy, player, opts?) → { move: Move|null, nextState: GameState, done: boolean, paused?: PlayTurnResult['paused'] }`。`playTurn` を stepTurn ループに再構成。
- [ ] 失敗テスト: stepTurn を done まで反復した最終 state が既存 playTurn の finalState と等価 (同 seed/policy)。1 回呼で 1 move 前進。endTurn で done=true。
- [ ] 実装: enumerate→choose→applyMove(1)→runAllUntilEmpty を切り出し。playTurn は while(!done) stepTurn。
- [ ] vitest pass (既存 policy/match テスト含む) → tsc → commit。

### Task 4: useOppTurnDriver per-move 駆動 + 信号 emit
**Files:** Modify `src/ui/hooks/useOppTurnDriver.ts` + `src/ui/state/store.ts` (activeCardUid/label state)。Test: `tests/ui/opp-turn-driver.test.ts`。
**Interfaces:** Consumes `stepTurn`, `aiSpeedMs`/`isAiPaused`/`aiStepCounter`。Produces store `activeCardUid`,`activeCardLabel`,`setActiveCard`。
- [ ] 失敗テスト: driver が 1手ごとに setGameState + setActiveCard、手間に aiSpeedMs 遅延、isAiPaused で停止 / aiStepCounter++ で1手進む。action 手は pauseOnAction で contact flow 委譲。
- [ ] 実装: 既存 playTurn 一括をやめ stepTurn ループ化 (fake timer テスト)。move 主体 uid を activeCard へ。
- [ ] vitest pass → tsc → commit。

### Task 5: FLIP 移動アニメ
**Files:** Create `src/ui/hooks/useFlipAnimation.ts`。Modify Playmat (scene/hand カードに適用)。Test: `tests/ui/flip-animation.test.ts`。
**Interfaces:** Consumes 安定 `data-uid`。Produces `useFlipAnimation(containerRef)` (描画前後の rect 差分を transform でトゥイーン)。
- [ ] 失敗テスト: uid 要素の前回 rect→新 rect の delta で transform→0 へ遷移する (jsdom: getBoundingClientRect mock で位置変化を検出)。
- [ ] 実装: First/Last/Invert/Play を useLayoutEffect で。手札→現場 / 推理タップ / アクション寄せに適用。
- [ ] vitest pass → tsc → commit。

### Task 6: 実機検証 + 全ゲート + 統合
**Files:** なし (検証) / 必要なら微修正。
- [ ] Playwright MCP: 対戦開始→自ターン→ターン終了→CPU が1手ずつ可視で着手 (速度スライダー反映・一時停止/ステップ動作)。効果解決中に ActionsPanel 不可・解決カードがポップ。console error 0、screenshot 証跡。
- [ ] full vitest 減なし / smoke baseline winsA 不変 / tsc0 / lint8本0。
- [ ] `npm run docs` → commit → PR (main へ)。

## Self-Review
- Spec A→Task2、B→Task1、C→Task3/4/5、D エッジ→各 task テスト、E state→Task4 store、F 水平展開→Task1 一括ロック、G→Task6。全節に task あり。
- Placeholder なし。型整合: `stepTurn`/`interactionLocked`/`activeCardUid`/`useFlipAnimation`/`useCardActivityPop` を Task 間で一貫使用。
