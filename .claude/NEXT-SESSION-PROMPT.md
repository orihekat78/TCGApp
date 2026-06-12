# 次セッション再開プロンプト (2026-06-12 カード wave#2 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**次は Fable 主体の engine 作業**: ④ リファクタ Phase 3〜4 か engine拡張 wave#2 (要ユーザー確認)。

> モデル方針: engine/refactor 系は `/model fable`。CLAUDE.md「トークン運用ルール」参照。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-12 末)

承認済作業順: ① Phase 0 → ② リファクタ 1c〜2c → ③ カード wave#2 (✅完了) → ④ リファクタ Phase 3〜4。
- ③ カード wave#2 完了 (commit af740281, main push 済, CI green)。green候補 codegen 経路は
  **枯渇** と判明 (105枚 harvest で吸収済) → 乖離0 の 3枚のみ出荷 (D09016/D09017/B05076)。
  詳細は memory.md + changelog-entries/2026-06-12-04。
- リファクタ Phase 0/1a/1b/1c/2a/2b/2c 完了・main push 済。残りは Phase 3a〜4。

## 次にやること (どちらか、着手前にユーザーへ確認)

**(A) リファクタ Phase 3〜4** (承認済 work order ④): refactor-plan/INDEX.md の Phase 3a 以降。
  /refactor-phase skill を呼び、着手前に個別設計レビュー必須。

**(B) engine拡張 wave#2** (card wave#2 で defer した後半): カードを大量解禁する engine ゲート群。
  - スコープ: .claude/specs/catalog-survey-2026-06-06/task-d-priority-map.json の wave2 ゲート
    (FILE-zone verb 30枚 / grant-textual-ability 23 / scene→deck 14 / hand-count cond 12 等、
    green-candidates-enriched で 182 sig 未実装)。骨格に触れるため gate 毎に設計レビュー必須。
  - **BUG-132 の GAP-1/2 修正** (deckRevealUntil decline channel / effect:declared 解決順序) を
    含めると、defer 中の **B08020/B08020P を再採用可能** (.tmp/certify/B08020.json + DEFERRED-INDEX 参照)。

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (B08020=BUG-132 gap / B07052=赤魔術 data-gate / refuted 4枚)
- bug: .claude/bugs/index.base (最新 BUG-132 = 共有 engine gap 2件)
- green候補マスタ: .claude/specs/catalog-survey-2026-06-06/ (capability 正本=capability-map.txt)

最初に (A)/(B) どちらに進むかをユーザーに確認し、対応 skill (refactor-phase / card-wave) を
呼んでから着手してください。engine 作業なので /model fable 推奨。
```

カード wave#2 は完了済。次は Fable 主体の engine 作業 (/model fable、(A) リファクタ Phase 3-4 か
(B) engine拡張 wave#2) を上記プロンプトで再開してください。
