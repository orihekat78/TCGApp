# 次セッション再開プロンプト (2026-06-12 engine拡張 wave#2 cluster1 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**次も Fable 主体の engine 作業** (engine拡張 wave#2 後続クラスタ or リファクタ Phase 3〜4)。

> モデル方針: engine/refactor 系は `/model fable`。CLAUDE.md「トークン運用ルール」参照。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-12 深夜)

承認済作業順: ① Phase 0 → ② リファクタ 1c〜2c → ③ カード wave#2 → ④ リファクタ Phase 3〜4。
ユーザー選択により ④ の前に **(B) engine拡張 wave#2** を開始済み。

- **engine拡張 wave#2 cluster1 ✅完了** (commit d7c4a2e9): BUG-132 GAP-1/2 修正 +
  B08020/B08020P 再採用 (ALL_CARDS 1128→1130)。詳細は
  .claude/specs/engine-wave2-bug132-design.md + changelog-entries/2026-06-12-05。
  全ゲート green (vitest 1979 / smoke baseline 完全一致 / e2e 119 / MCP 実機 decoy)。
- 水平展開で BUG-133〜136 起票 (修正は defer、各 BUG-XXX.md に調査データ添付済)。

## 次にやること (どちらか、着手前にユーザーへ確認)

**(A) engine拡張 wave#2 後続クラスタ**: task-d-priority-map.json の wave2 ゲート群
  (FILE-zone verb 30枚 / grant-textual 23 / scene→deck 14 / hand-count 12 等 ~182 sig)。
  /card-wave skill を呼び、gate 毎に設計レビュー必須。1 gate = 1 クラスタ = 1 commit 推奨。

**(B) リファクタ Phase 3〜4** (承認済 work order ④): refactor-plan/INDEX.md の Phase 3a
  (atom-handlers 1391行分割) から。/refactor-phase skill + 着手前個別設計レビュー必須。

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (B08020 再採用済 / B01048 identity 選択=確認待ち /
  AI decline / カットイン反応ポイント / BUG-133〜136)
- bug: .claude/bugs/index.base (BUG-132 修正済 d7c4a2e9 / BUG-133〜136 未着手)
- 公式 Q&A 一次データ: cards-data TSV の qAndA 列 (rules/25・26 に主要裁定収載済)。
  カード個別裁定は web fetch 前に必ず TSV を見ること

最初に (A)/(B) どちらに進むかをユーザーに確認し、対応 skill を呼んでから着手してください。
engine 作業なので /model fable 推奨。
```

engine拡張 wave#2 cluster1 (BUG-132) は完了済。次は上記プロンプトで (A) 後続ゲート群 か
(B) リファクタ Phase 3〜4 を選択して再開してください。
