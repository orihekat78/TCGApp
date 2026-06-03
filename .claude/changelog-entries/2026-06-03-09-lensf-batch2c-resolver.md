---
date: 2026-06-03
title: Lens F 監査 修正バッチ2c — resolver sequence の pick pause/continuation (BUG-105)
type: fix
scope: engine
---

## resolver sequence の pick-await pause (BUG-105 / group C)

`resolver.ts` の `sequence` が pick で pause せず、pick を含む step の後段が pick 解決前の盤面で
評価される不具合を修正。`chain` 同型の pick-await pause + `__pendingChainContinuation` 退避を追加
(no-apply-break は無し=各 step 独立)。pick を含まない sequence は従来通り一括実行 (動作不変)。

- **D08024 a1 / D11020 a1 (state 依存)**: ✅ 修正。後段 step が post-pick 盤面 (登場キャラ / リムーブ) を見る。
- **D11014 a2 (bind 依存)**: ⚠ 部分。sceneEnter は正しい順で実行されるが `$entered` bind が
  step3 continuation に伝播しない (別途 bind-propagation 課題、範囲外)。
- **D08013 (BUG-078)**: 保護。step2 が post-step1 evidence を pick、step3 は continuation で resolve。
  bug-077 Phase F を新機構 (pause→continuation) に更新。

## 検証

- tsc / vitest **1675 PASS** (bug-077 全15、Phase F を pause/continuation 機構に更新) / smoke 1000 例外0 (500/500) /
  **Playwright 63/64** (D08013 含む全 e2e、resolver 変更の UI 回帰なし)。
- 継続課題: D11014 $entered bind 伝播 / AI 経路の side-channel pick drain (D08021 と同根) / E (D11012 choiceIndex)。
