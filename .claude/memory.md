# 作業ログ — 名探偵コナンTCG プロジェクト

> wave#2 (カード) までの経緯は sessions/2026-06-12.md + changelog-entries 参照。

## 現在地 (2026-06-12 深夜)

### engine拡張 wave#2 cluster1 — BUG-132 GAP-1/2 修正 + B08020/P 再採用 ✅ (branch engine/wave2-bug132)

- **GAP-1**: deckRevealUntil `chooseMatch:'upTo'` (38枚+B08020/P) — human は全match から取得/decline/
  identity 選択、decline は applyPickSkipAndContinuation で remainder (デッキ下) 続行。AI 不変 →
  smoke baseline 完全一致。overlay hold (awaitingPick)。forced 10枚は TSV qAndA で現状=公式準拠と確定
- **GAP-2**: declaredBatch pairwise gate (own→反応の順、ownerChosenOrder 不変) + declaredReaction の
  runOne 遅延 substitute (解決時盤面で候補確定)。emit 後置は rules/15 §発動済と衝突で棄却 (敵対レビュー)
- **検証**: pin 6本新設 / vitest full / smoke 一致 / e2e 119 (3 spec 更新: bug-117 / engine-extensions /
  reasoning-hook — human 経路は pick 1段解決を挿入) / MCP 実機 decoy (a1 kind+色 decoy 除外・
  take/decline、a2 除去済+AP9000 decoy 除外・ターン1消費)・console error 0
- **水平展開**: BUG-133 (drain guard) / BUG-134 (他hook queue時pick、hook×pick データ) /
  BUG-135 (skip-drop 62候補) / BUG-136 (デッキ下順序)。rules/25・26 に公式Q&A 収載 (TSV qAndA 一次)
- **教訓**: (1) TSV qAndA 列は カード個別裁定の一次データ — web fetch 前に必ず見る。
  (2) runtime push する side-channel 値は toPlainDeep 必須 (draft proxy → revoked crash)。
  (3) 「まで」regex は「出るまで」に誤マッチする — 分類は公式全文で

### 残 (engine拡張 wave#2 後続クラスタ、未着手)

task-d-priority-map wave2 ゲート群: FILE-zone verb 30 / grant-textual 23 / scene→deck 14 /
hand-count 12 等 (~182 sig)。gate 毎に設計レビュー必須。

## ポインタ

- 設計: `.claude/specs/engine-wave2-bug132-design.md` (v2、レビュー3lens反映)
- defer: `.claude/specs/DEFERRED-INDEX.md` (B08020 再採用済 / B01048 identity / AI decline / cutin 反応)
- bug: `.claude/bugs/index.base` (BUG-132 修正済、BUG-133〜136 新規)
