# 次セッション再開プロンプト (2026-06-14 engine拡張 wave#2 cluster3 完了時点)

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

- **cluster1 ✅** (BUG-132 + B08020/P 再採用、commit d7c4a2e9)
- **cluster2 ✅** (ability-presence filter + BUG-137/138/139、commit ec6c9780)
- **BUG-140 補修 wave ✅** (commit 3606f829): 出荷済 74 枚の cutIn/hirameki 欠落を一括補修
- **cluster3 ✅** (commit ae934642): action-lifecycle trigger 族 15枚解禁 + 骨格バグ2件修正。
  engine X9-X16 (evidence:gain emit / action:end・evidence:gain を card-triggerable 化 /
  triggerActionKind cond / scope:'action' modifier / action:declare targetUid /
  CPU declare-drain BUG-141 / evidenceGain refresh BUG-142 / contact driver pause gate)。
  ALL_CARDS 1140→1152。DEFER B06049。全ゲート green (vitest 2074 / smoke baseline byte 一致 /
  e2e 119 / MCP console err 0)。BUG-143/144 繰越起票。

## 次にやること (どちらか、ユーザー確認推奨)

### (A) engine拡張 wave#2 cluster4 (残 yellow から次クラスタ)
残ゲートの機械再集計は `.tmp/cluster3-recount.cjs` を流用 (classify-triage.json yellow ×
git ls-files で pending sig)。cluster3 出荷後の残有力候補:
usage restriction (6枚) / scene→deck verb (9枚) / remove-area→deck-bottom (5枚) /
card-name rewrite (3枚) / untargetable grant (3枚) 等。
**/card-wave skill を呼び、gate 毎の設計レビュー (Workflow 調査 + 敵対設計レビュー) 必須。**

### (B) リファクタ Phase 3〜4 (承認済 work order ④)
refactor-plan/INDEX.md Phase 3a から。engine 大規模リファクタは Fable 主体 (/model fable)。
/refactor-phase skill を呼ぶ。

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (cluster3 節 = B06049 + reasoning refresh 繰越 + BUG-143/144 + U1/U2)
- bug: .claude/bugs/index.base (BUG-141/142 修正済、143/144 未着手)
- 設計記録: .claude/specs/engine-wave2-action-triggers-design.md (v2) / sessions/2026-06-14.md
- 公式 Q&A 一次データ: cards-data TSV qAndA 列 (web fetch 前に必ず見る)

/card-wave (A) または /refactor-phase (B) を呼んでから着手してください。
```

cluster3 は完了済。次は上記 (A) cluster4 または (B) リファクタ Phase 3〜4 から開始してください。
