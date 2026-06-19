# 次セッション再開プロンプト (2026-06-19 — CPU可視化+割り込みロック core 出荷、残 FLIP)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP「人間vsCPU 操作可視化 + 割り込みロック」機能。
まず CLAUDE.md → 設計 spec → 実装計画 → memory.md を読む。

## ★★最優先 BUG (2026-06-19 ユーザー報告、main 取込み保留中)
**「毎ターン登場時(【登場時】)効果が発動している」** — 実機 (localhost:5173 人間vsCPU) で CPU の
【登場時】効果が毎ターン発動して見える。スクショで opp の D08013 が effect:sceneSetState を毎ターン
人間キャラ(吉田歩美)に適用。**core を main に取り込む前に要修正** (ff-merge 保留)。
調査方針:
- これが Task4 per-move 駆動の regression か、CPU 可視化で顕在化した既存 engine/AI バグかをまず切り分け。
  per-move は「moveの適用タイミング」のみ変更 (enter hook ロジックは applyMove→runAllUntilEmpty で従来同一)。
  smoke (playTurn byte等価/winsA不変) は緑なので headless AI-vs-AI では再現しない可能性 → 人間vsCPU 経路 (useOppTurnDriver) 固有を疑う。
- 確認: driveOppTurn の oppMoveTick 再fire / isDriving guard で同一 enter move が二重適用されていないか
  (二重なら【登場時】二重発火)。useOppTurnDriver の useEffect 多重発火 (setGameState/setActiveCard/bumpOppMoveTick の3 set による) も疑う。
- D08013 のカード定義 (【登場時】sceneSetState) を確認し、CPU が毎ターン再登場しているのか
  既存カードが再発火しているのかを live state + LOG で特定。
- 修正後: tsc/vitest/smoke/実機再検証 → core(Task1-4)+fix をまとめて main 取込み。

## 現在地 (2026-06-19、main に core 取込み済 / branch feat/cpu-visualize-interrupt-lock)

ユーザー要望 2 点を実装中。**Task1-4 (core) は完成・実機検証OK・main 取込み済**:
1. 効果解決中に他操作ができてしまうバグ → 解決中ロック (Task1) 済。
2. CPU の手が見えない/速度調整が無意味 → CPU を実盤面で1手ずつ可視化 (Task3 stepTurn + Task4 per-move 駆動) + 発動カードのその場ぴこんポップ (Task2) 済。速度スライダー/一時停止/1ステップが全手に効くことを実機確認済。

設計: .claude/specs/2026-06-19-cpu-visualize-and-interrupt-lock-design.md
計画: .claude/specs/plans/2026-06-19-cpu-visualize-and-interrupt-lock-plan.md

## 完了 (Task1-4、検証済: tsc0 / vitest 2644 / smoke winsA=498不変 / 実機Playwright)
- Task1: selectInteractionLocked (src/ui/state/interactionLock.ts) + ActionsPanel interactionLocked prop + Playmat 配線。
- Task2: SceneArea activeCardUid/activeCardLabel → is-active-pop + card-activity-chip (その場ぴこん、全画面ポップ不採用)。
- Task3: src/ai/policy.ts stepTurn (playTurn 分解、byte 等価)。
- Task4: useOppTurnDriver を per-move 駆動 (stepTurn + activeCard + store.oppMoveTick 再fire)。store に activeCardUid/Label/oppMoveTick 追加。vitest.config に .claude/worktrees exclude (stale 重複除去で full vitest=2644 に正規化)。

## ★残 Task5: FLIP 移動アニメ (polish、core と独立)
- 新規 src/ui/hooks/useFlipAnimation.ts (安定 data-uid で描画前後の rect 差分を transform トゥイーン)。
- Playmat/SceneArea/HandZone に適用: 手札→現場スライド登場 / 推理=タップ横向き / アクション=攻撃元が対象へ寄る。
- TDD (jsdom: getBoundingClientRect mock で前後 rect 変化を検出) → 実機 Playwright で動き確認 → commit → main。
- ユーザー確定方針: アニメ度=「標準」(移動トゥイーン+ぴこんポップ)。MasterDuel風、過剰演出なし。

## プロセス必須
- 骨格凍結: src/engine 不変 (core は engine 無改変で達成済)。AI/UI 層で実装。TDD・1 task=1 commit (heredoc, Co-Authored-By)。
- Read hook が file を line1 で切る → Bash cat / Edit 前に Read 1 回で登録。
- pre-commit = docs:check + 規約 lint 8本 (eslint は CI/pre-commit のゲートに非含)。新 src/test/spec 追加で structure/mapping 変わる → npm run docs 同期後 commit。
- CI は main push / PR のみ (feature branch は走らない)。core は main 取込み時に CI green 確認済の想定。
- 実機確認は playwright MCP (localhost:5173)。CPU速度=最遅 で per-move を視認、高速 で完走確認。
```

Task1-4 (core: ロック + CPU逐次可視化) は main 取込み済・実機検証OK。**残は Task5 FLIP のみ。** `/clear` 後の新セッション推奨。
