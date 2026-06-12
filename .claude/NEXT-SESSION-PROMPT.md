# 次セッション再開プロンプト (2026-06-13 engine拡張 wave#2 cluster2 完了時点)

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
- **cluster2 ✅完了** (ability-presence filter): 現リム時/疾風/カットイン presence filter (X1/X1b) +
  boundToRemove (X6) + 骨格バグ3件修正 (BUG-137 mill refresh / BUG-138 pick横取り / BUG-139 必須pick黙殺) +
  解禁10枚 (ALL_CARDS→1140)。詳細は .claude/specs/engine-wave2-ability-filter-design.md +
  changelog-entries/2026-06-13-01。全ゲート green (vitest 2016 / smoke baseline 完全一致 / e2e 119 / MCP decoy)
- 水平展開で **BUG-140 起票** (出荷済76枚の cutIn/hirameki 欠落、B04096/P のみ補修済・残74枚 defer。
  監査: npx tsx scripts/audit-icon-abilities.mts)

## 次にやること (どれか、着手前にユーザーへ確認)

**(A) engine拡張 wave#2 後続クラスタ**: 残ゲートの機械再集計から選定 (cluster2 と同手順:
  classify-triage.json yellow × git ls-files で pending sig を出す)。有力候補:
  action-subtype trigger (8枚) / usage restriction (6枚) / name-designation (8枚) /
  multi-card sceneEnter (6枚)。/card-wave skill + gate 毎設計レビュー必須。

**(B) BUG-140 補修 wave**: 欠落 hirameki 63 + cutin 13 の一括補修 (定型テンプレ化可能、
  D05007 a2 同型が大半)。完了後 audit script を lint 化して CI 組込み。opus 主体で安価。

**(C) リファクタ Phase 3〜4** (承認済 work order ④): refactor-plan/INDEX.md の Phase 3a
  (atom-handlers 分割 — cluster2 で +100行 増えており分割価値上昇) から。/refactor-phase skill。

## 状態 doc
- defer 一覧: .claude/specs/DEFERRED-INDEX.md (cluster2 defer 6種 + BUG-140 残74枚 + wave#1 繰越)
- bug: .claude/bugs/index.base (BUG-137/138/139 修正済 / BUG-140 未着手・audit data 添付)
- 公式 Q&A 一次データ: cards-data TSV qAndA 列 (rules/17 に presence 静的判定の裁定収載済)。
  カード個別裁定は web fetch 前に必ず TSV を見ること

最初に (A)/(B)/(C) どれに進むかをユーザーに確認し、対応 skill を呼んでから着手してください。
```

engine拡張 wave#2 cluster2 (ability-presence filter) は完了済。次は上記プロンプトで
(A) 後続ゲート / (B) BUG-140 補修 / (C) リファクタ Phase 3〜4 を選択して再開してください。
