# 次セッション再開プロンプト (2026-06-19 — CPU可視化+割り込みロック 実装中、Task1 完了)

> モデル方針: `claude-fable-5` agent 不可のため本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP「人間vsCPU 操作可視化 + 割り込みロック」機能の実装を継続。
まず CLAUDE.md → 設計 spec → 実装計画 → memory.md を読む。

## 現在地 (2026-06-19、branch feat/cpu-visualize-interrupt-lock、Task1 完了済 commit 8a0af5b1)

ユーザー要望 2 点を実装中:
1. カード効果解決中に他操作ができてしまうバグ → 解決中は操作ロック + 解決カードを可視化。
2. 人間vsCPU で CPU の手が見えない → CPU が実盤面で 1 手ずつ人間ライクに着手 (速度連動)。

設計: .claude/specs/2026-06-19-cpu-visualize-and-interrupt-lock-design.md
計画 (6 task): .claude/specs/plans/2026-06-19-cpu-visualize-and-interrupt-lock-plan.md
UI 方針確定: 全画面ポップ廃止 → 発動カードが **その場でぴこんと浮く** (MasterDuel風)。CPU は
カードを実際に動かす (手札→現場/推理タップ/アクション寄せ、移動トゥイーン=FLIP、ぴこんポップ、速度スライダー連動)。

## 完了
- ★Task1 (効果解決中ロック): selectInteractionLocked (src/ui/state/interactionLock.ts) +
  ActionsPanel interactionLocked prop + Playmat 配線。test 6 (selector4/SSR2)、UI全842 pass、tsc0。
  branch push 済 (CI 確認: gh run list)。

## 残 Task (計画通り、各 TDD + 独立 commit)
- Task2: アクティブカード ぴこんポップ (src/ui/hooks/useCardActivityPop + チップ component + CSS。
  pendingEffects[top].source.uid → 該当 [data-uid] カードをその場拡大+グロー〜150ms)。
- Task3: AI stepTurn — src/ai/policy.ts の playTurn を 1手駆動に分解 {move,nextState,done}。
  playTurn は stepTurn ループに再構成し最終 state 等価をテスト。AI層=骨格外。
- Task4: useOppTurnDriver を per-move ループ化 (1手 stepTurn→反映→aiSpeedMs 待ち→次手)。
  store に activeCardUid/label 追加。既存 aiSpeedMs/isAiPaused/aiStepCounter (右上 SpectatorHUD/CPU制御) を per-move 流用。action 手は既存 pauseOnAction + useContactFlowDriver 維持。
- Task5: FLIP 移動アニメ (src/ui/hooks/useFlipAnimation、安定 data-uid で前後 rect 差分トゥイーン)。
- Task6: Playwright MCP 実機検証 (対戦開始→ターン終了→CPU 1手ずつ可視・速度反映 / 効果解決中 ActionsPanel 不可) + full vitest 減なし + smoke baseline winsA 不変 + lint8本 + npm run docs → PR (main へ)。

## プロセス必須
- 骨格凍結: src/engine/ は不変 (Task1 も engine 無改変で達成)。AI/UI 層で実装。
- TDD: 失敗テスト→実装→pass→commit。1 task=1 commit (Bash heredoc, Co-Authored-By)。
- Read hook が file を line1 で切る → Bash cat / Edit 前に Read 1 回で登録。
- pre-commit docs:check: 新 src/test/spec 追加で structure/mapping 変わる → npm run docs 同期後 commit (--no-verify 禁止)。
- 検証 reviewer/難判断 agent は model:'opus'。
- 実機確認は playwright MCP 第一 (localhost:5173 dev server)。「画面処理=テキスト文言」decoy 1対1。
```

Task1 (割り込みロック) 完了・branch push 済。**残 Task2〜6 は計画通り順次。** `/clear` 後の新セッション推奨。
