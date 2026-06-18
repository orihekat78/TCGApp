# 設計: CPU逐次プレイ可視化 + 効果解決中の入力ロック (2026-06-19)

人間 vs CPU の 2 課題を 1 つの「アクティブカード」インフラで解く。
ルール根拠: rules/05 §割り込み禁止、rules/15 §未解決効果。骨格 (`src/engine/`) は原則不変。

## 目的 (2 課題)
1. **割り込み防止**: カード効果解決中に他の操作 (推理/アクション/手札使用/ネクストヒント/宣言/アシスト/事件解決) ができてしまうバグを塞ぐ。どのカードが解決中か可視化。
2. **CPU 可視化**: CPU の手番を 1 手ずつ実盤面で可視化 (人間ライク)。速度スライダーを全手に効かせる。

## A. 共通インフラ — アクティブカード信号
- 単一信号 `activeCardUid` (+ 行動ラベル) を購読し、盤面の実 `[data-uid]` カードを **その場で軽くポップ** (拡大+浮き+グロー 〜150ms、MasterDuel風)。全画面ポップ/暗転は不採用。
- カード上に小チップ「登場/推理/アクション/効果解決 + カード名」。
- 信号源: 効果解決 = `pendingEffects[top].source.uid`、CPU 手 = 適用中 Move の主体 uid。
- 新規 hook `useCardActivityPop` (uid 受領→DOM クラス付与/除去)。

## B. 課題1 — 効果解決中ロック
- engine `effect/index.ts` に `hasPendingHumanPick()` を **再 export** (既存 globalThis side-channel を読むだけ、挙動不変)。
- UI 派生 `interactionLocked = pendingEffects.length>0 || hasPendingHumanPick()`。
- ロック時: [ActionsPanel](../../src/ui/components/ActionsPanel.tsx) 全 8 項目 disabled + [Playmat onActionItemClick](../../src/ui/components/Playmat.tsx) で flow 開始を弾く。解決中カードを A でポップ + 「🔒 効果解決中」表示。
- 非ロック (required 入力): pick/choice/optional modal、guard/cutin 窓は従来通り (割り込みでない)。

## C. 課題2 — CPU 逐次プレイ
- `src/ai/policy.ts` に **`stepTurn(state, policy, player) → {move, nextState, done}`** (enumerate→choose→applyMove 1 手→`runAllUntilEmpty`)。`playTurn` は stepTurn ループに再構成 (最終 state 等価)。AI 層=骨格外。
- [useOppTurnDriver](../../src/ui/hooks/useOppTurnDriver.ts): 「1手 stepTurn→反映→`aiSpeedMs` 待ち→次手」ループ。action 手は既存 `pauseOnAction` + useContactFlowDriver を維持。
- **FLIP 移動アニメ** (`useFlipAnimation`, 安定 `data-uid` で前後位置差): 手札→現場スライド登場 / 推理=タップ横向き+証拠加算 / アクション=攻撃元が対象へ寄る。
- 既存 `aiSpeedMs`/`isAiPaused`/`aiStepCounter` (右上 CPU速度/一時停止/1ステップ) を **per-move** に流用。

## D. エッジケース
- 効果が同期で即解決 (modal 無) → pendingEffects は dispatch 内で空に戻る → ロック残留なし。
- CPU 手番中の human guard/cutin 窓 → interactionLock 対象外 (別 surface)。
- CPU action 手 (pauseOnAction) → stepTurn が paused を返し contact flow へ委譲、完了後 step 再開。
- 0 手ターン (endTurn のみ) → ポップ無しで即終了表示。
- リフレッシュ/勝敗確定が手の途中 → stepTurn の nextState に反映、done/gameResult で停止。
- カード離場後にポップ対象 uid が消失 → uid 不在なら no-op (例外なし)。

## E. state → UI 対応
| 信号 | 由来 | UI |
|---|---|---|
| `activeCardUid`/label | pendingEffects.source / 適用中 Move | ぴこんポップ + チップ |
| `interactionLocked` | pendingEffects + hasPendingHumanPick | ActionsPanel disabled / click 拒否 |
| `aiSpeedMs`/`isAiPaused`/`aiStepCounter` | store (既存) | per-move ペース / 一時停止 / 1ステップ |

## F. 水平展開
- ロックは ActionsPanel の 8 項目すべて + Playmat の全 flow 起点 (推理/アクション/手札/ネクスト/宣言/アシスト/事件解決) を一括で塞ぐ (1 派生フラグ)。
- ポップは効果解決・CPU 手・(任意で) 人間手にも同一 hook で適用し挙動統一。

## G. 検証
- vitest: stepTurn 単体 (1手前進/done/playTurn 最終 state 等価) / interactionLocked で各 action 起点が弾かれる。
- Playwright 実機: 対戦開始→ターン終了→CPU が 1 手ずつ可視で着手 (速度スライダー反映) / 効果解決中に ActionsPanel 不可・解決カードがポップ。console error 0。
- 既存 smoke baseline 不変 (engine 挙動不変)、full vitest 減なし。

## 触るファイル
engine: `effect/index.ts` (再export のみ)。AI: `ai/policy.ts`。UI: `useOppTurnDriver.ts` / `ActionsPanel.tsx` / `Playmat.tsx` + 新規 `useCardActivityPop` / `useFlipAnimation` / ポップ・チップ小コンポーネント。
