# 次セッション再開プロンプト (2026-06-15 cluster9 出荷 / cluster10・11 defer 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ✅ **push 済**: cluster9 (`7a89c5dc`) + cluster10 defer 記録 (`197e1207`) は main に push 済・CI green。
> 次セッション開始時は `git log origin/main..main` が空であることを確認。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、engine拡張 wave#2 cluster9 出荷時点)

- engine拡張 wave#2 cluster1〜9 ✅ + BUG-145 ✅ + 赤魔術 family ✅。ALL_CARDS = 1177。origin 同期済 (`197e1207`, CI green)。
- 直近セッション = 残 backlog engine gate の batch (1セッション複数・別コミット方針) を実施。triage workflow の
  landscape = 残 **19 独立 engine gate** (詳細は DEFERRED-INDEX のランク表)。結果:
  - **cluster9 = setcard:leave hook ✅ 出荷** (5枚: B07034/B07034P/PR231 a1+a2 + B02020/B02020P a1)。per-occurrence
    emit (scene removeToRemove/toDeck/toHand の splice 前 + char removeOneSetCard)。emit-before-splice が self-leave
    Q&A を支える load-bearing 不変条件 (専用 test でピン留め)。known-gap = faceUp vacuous / cross-char 同時離場 順序依存。
  - **cluster10 = loseGame verb ⛔ defer**: landscape の「低リスク3枚」は certify で誤りと判明。全敗北カードは
    事件解決能力 書き換え (勝利条件介入 high-risk) or 証拠reveal+特徴[犯人]≥8 の multi-gate。
  - **cluster11 = enter-source-level ⛔ defer**: **BUG-146** に block。effect/能力登場で entered char の【登場時】
    (selfOnly) が engine 全体で不発火 (atom が enter emit source を ctx.source=原因カードにしており selfOnly 不一致)。
    enterSource 条件ロジック自体は diag で正と確認済 (partial work は破棄、main クリーン)。

## 次にやること (候補、ユーザーと相談 or triage から選定)

- **BUG-146 修正 + enterSource + cluster11 (B01014/B01015/B01021/B07019) を coupled 専用クラスタ**で同時出荷:
  sceneEnter/sceneSwitch atom の enter emit source を **登場キャラ** に統一 (原因カードは payload.sourceCardId へ) →
  selfOnly【登場時】が効果登場でも発火 + enterSource condition が機能。**高リスク広域変更**: 全効果登場キャラの【登場時】が
  新たに発火 → 既存挙動が広く変化 + smoke baseline 移動の可能性大。全 enter listener (非selfOnly/triggerCharMatches/疾風)
  の水平展開 + 敵対設計レビュー (opus) + smoke 再 bless 必須。設計詳細は BUG-146.md / DEFERRED-INDEX cluster11 節。
- or backlog の別 gate (DEFERRED-INDEX landscape: name-designation 11枚 / multi-card sceneEnter 6枚 等、いずれも needs-design)。
- 低 urgency engine bug 群: reasoning 由来 refresh (BUG-142 水平展開) 等は DEFERRED-INDEX 参照。

## プロセス必須
- /card-wave skill。**triage landscape の未精読 gate の「low risk」は信用しない** (cluster10/11 とも過小評価だった)。
  per-card certify + 挙動 diag で実証してから着手。green候補は未certify なら信用しない (PR138/B01011 教訓)。
- engine 変更は骨格凍結例外手続き (rule/bug 根拠) + 敵対設計レビュー (opus 3-lens) + 全 gate (full vitest / smoke 再 bless /
  playwright / CI lint 8本)。非MVP カードは behavioral vitest が実機検証の正 (enter hook 経由 test も書く = BUG-146 教訓)。
- 1 gate = 1 独立コミット (mega-commit 禁止 = 回帰切り分け不能)。docs commit は pre-commit docs:check の LF/CRLF churn 対策で
  `npm run docs` → `git add -A` → commit。

## 状態 doc
- bug: .claude/bugs/index.base (**BUG-146 未修正 = 効果登場の【登場時】不発火、要対応**)
- defer: .claude/specs/DEFERRED-INDEX.md (cluster10/11 defer 節 + cluster9 known-gap + landscape 19 gate ランク)
- 詳細: changelog-entries/2026-06-15-06 (cluster9) / session: .claude/sessions/2026-06-15.md + 2026-06-15-2.md / memory.md
```

直近セッションは cluster9 出荷 (push 済 `7a89c5dc`) + cluster10/11 defer + BUG-146 起票 (push 済 `197e1207` + 本 docs commit)。
次セッションは origin 同期確認 → BUG-146+cluster11 専用クラスタ or 別 gate 選定から。`/clear` で新セッション推奨。
