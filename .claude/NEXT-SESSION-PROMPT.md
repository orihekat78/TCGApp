# 次セッション再開プロンプト (2026-06-13 BUG-140 補修 wave 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針: engine/refactor 系は `/model fable`、カード補修系は opus 推奨。CLAUDE.md「トークン運用ルール」参照。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-13)

承認済作業順: ① Phase 0 → ② リファクタ 1c〜2c → ③ カード wave#2 → ④ リファクタ Phase 3〜4。
ユーザー選択で ④ の前に engine拡張 wave#2 を実施中。

- **cluster1 ✅** (BUG-132 + B08020/P 再採用、commit d7c4a2e9)
- **cluster2 ✅** (ability-presence filter + BUG-137/138/139、commit ec6c9780)
- **BUG-140 補修 wave ✅** (commit 3606f829): 出荷済 74 枚の cutIn/hirameki 欠落を決定論パッチで
  一括補修 (直接 52 + spread 継承 22)。lint:icon-abilities 新設 (CI 規約 8 本目)。挙動テスト 8 件。
  DEFER 2 枚 (B05039/B06035、DEFERRED-INDEX + lint allowlist に記載)。
  全ゲート green (vitest 2024 / smoke baseline 完全一致 / e2e 119)

## 次にやること: (A) engine拡張 wave#2 cluster3 (ユーザー選択済 2026-06-13)

残ゲートの機械再集計から選定 (cluster2 と同手順:
.claude/specs/catalog-survey-2026-06-06/classify-triage.json の yellow × git ls-files で
pending sig を出す)。有力候補: action-subtype trigger (8枚) / usage restriction (6枚) /
name-designation (8枚) / multi-card sceneEnter (6枚)。
**/card-wave skill を呼び、gate 毎の設計レビュー (Workflow 調査 + 敵対設計レビュー) 必須。**
cluster2 の手順記録: .claude/specs/engine-wave2-ability-filter-design.md + sessions/2026-06-13.md

その後の選択肢: (C) リファクタ Phase 3〜4 (承認済 work order ④、refactor-plan/INDEX.md Phase 3a から)

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (cluster2 defer 6種 + BUG-140 defer 2枚 + wave#1 繰越)
- bug: .claude/bugs/index.base (BUG-137〜140 全件修正済)
- 公式 Q&A 一次データ: cards-data TSV qAndA 列 (rules/17 に presence 静的判定の裁定収載済)。
  カード個別裁定は web fetch 前に必ず TSV を見ること

/card-wave skill を呼んでから着手してください。
```

BUG-140 補修 wave は完了済。次は上記プロンプトで (A) engine拡張 wave#2 cluster3 を開始してください。
