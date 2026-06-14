# 次セッション再開プロンプト (2026-06-14 engine拡張 wave#2 cluster4 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14 改定): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**
> 使う (fable を先に試さない)。難判断 agent (certify / 意味等価突合 / 敵対レビュー) は `model:'opus'` を明示。
> fable 再開時に難判断・本体を fable に戻す。詳細は CLAUDE.md「トークン運用ルール」。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/memory.md → .claude/specs/refactor-plan/INDEX.md を読んで状況を把握すること。

## 現在地 (2026-06-14)

承認済作業順: ① Phase 0 → ② リファクタ 1c〜2c → ③ カード wave#2 → ④ リファクタ Phase 3〜4。
ユーザー選択で ④ の前に engine拡張 wave#2 を実施中。

- **cluster1 ✅** (BUG-132 + B08020/P、commit d7c4a2e9)
- **cluster2 ✅** (ability-presence filter + BUG-137/138/139、commit ec6c9780)
- **BUG-140 補修 wave ✅** (commit 3606f829)
- **cluster3 ✅** (commit ae934642): action-lifecycle trigger 族 15枚 + 骨格バグ2件 (BUG-141/142)
- **モデル方針改定 ✅** (commit be379294): fable→opus
- **cluster4 ✅** (commit 431b8eed): remove-area → deck-bottom 解禁6枚 + engine additive 2プリミティブ
  (新 Cost removeAreaToDeckBottom / 新 AtomVerb removeAreaAllToDeckBottom)。ALL_CARDS 1152→1158。
  DEFER B07025。全ゲート green (full vitest 2086 / smoke baseline 完全一致 / playwright MCP / pre-commit)。CI green。

## 次にやること (どちらか、ユーザー確認推奨)

### (A) engine拡張 wave#2 cluster5 (残 yellow から次クラスタ)
残ゲート機械再集計は `node .tmp/cluster3-recount.cjs` を流用 (classify-triage.json yellow ×
git ls-files で pending sig)。cluster4 出荷後の残有力候補 (genuinely-new-engine):
usage restriction (5枚、相手カットイン不可 aura + 変装抑止 + event-use ban、med risk) /
card-name rewrite・untargetable grant は high risk で DEFER 済 (.tmp/cluster4-triage.json 参照)。
scene→deck / hand-count は engine 実装済で「非 engine の通常 wave」(他句 block で pending)。
**/card-wave skill を呼び、gate 毎の設計レビュー (Workflow 調査 + 敵対設計レビュー) 必須。**

### (B) リファクタ Phase 3〜4 (承認済 work order ④)
refactor-plan/INDEX.md Phase 3a から。engine 大規模リファクタ。/refactor-phase skill を呼ぶ。

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (cluster4 節 = B07025 + B08066 leave:remove-area gap + UI picker)
- bug: .claude/bugs/index.base (BUG-141/142 修正済、143/144 未着手)
- 設計記録: .claude/specs/engine-wave2-cluster4-remove-area-design.md / sessions/2026-06-14-2.md
- triage 出力: .tmp/cluster4-triage.json (6 gate 評価) / .tmp/cluster4-design.json (設計+敵対レビュー)
- 公式 Q&A 一次データ: cards-data TSV qAndA 列 (web fetch 前に必ず見る)

/card-wave (A) または /refactor-phase (B) を呼んでから着手してください。
```

cluster4 は完了済。次は上記 (A) cluster5 または (B) リファクタ Phase 3〜4 から開始してください。
