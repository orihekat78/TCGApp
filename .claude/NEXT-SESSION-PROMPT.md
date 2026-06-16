# 次セッション再開プロンプト (2026-06-16 engine拡張 cluster15 removal-observer + 26枚出荷 完了 — ALL_CARDS 1327)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、engine拡張 cluster15 完了、HEAD≈46a6fcd6、ALL_CARDS=1327)

直近セッションで以下を完遂 (commit 46a6fcd6、main push 済、CI 確認中):
- **方針 (ユーザー判断、memory feedback-engine-cluster-over-green-tail)**: 残 green は 170 distinct の novel 裾なので
  green候補刈り取りより **engine クラスタ拡張を優先**。当初候補 cutin-subtype は **sweep 誤ラベル**(真の subtype filter ~1枚) と
  実証 → **contact-removal-observer (反撃カード一族, 53枚) にピボット**。
- **engine 拡張 (骨格凍結例外、新 condition `removedCharMatches` 1個・全 additive)**: `removeToRemove` optional byUid +
  `leave:to-remove` payload に side/byUid + `contact.judge` aUid 渡し。spec: `.claude/specs/engine-cluster15-contact-removal-observer-design.md`。
  実装前 **opus 3-lens 敵対設計レビュー**で実害3件捕捉 (B09026 誤分類/excludeSource 欠落/level-ap 層越え) → v2 反映。
- **28 rep certify → 26枚出荷** (verifiedOk green 14 rep + clone 12)。unit 11 + gate5 8 pass / 全 gate green (vitest 2579 /
  smoke baseline winsA=498 不変 / playwright 119 / lint:* 8本 / validate-specs fail=0)。
- **DEFER 14 rep** (反撃 ability は全 green、他句が別 gate): DEFERRED-INDEX 記載。

## ★最優先候補 (いずれか)

1. **partnerColorKeyword needsManual follow-up (FAST)**: B06038/B06039/B08010/B09071 = certify verified green だが
   `partnerColorKeyword` closure (continuousModifier.grantKeywords) で codegen 不可。`src/cards/_shared/partnerColorKeyword.ts` +
   exemplar (B08007 / D11007) を見て **手書き出荷** (反撃 a2 は cluster15 で解禁済、B08010 の JSON twin は出荷済)。clone 込み ~8枚。
2. **次の密 engine クラスタ** (cutin-subtype の教訓 = **着手前に実テキスト決定論分類で密度検証**):
   候補 = cardName-EXCLUSION filter (B06087/PR280 + 全残スキャン、小) / grant-textual+set→host (~50、要 homogeneity 検証) /
   dynamic-count family (~45)。`.tmp/sweep/landscape.json` の text を node で分類 → opus 3-lens 敵対設計レビュー → 全 gate。
3. **トリアージ出荷バッチ#5** (green 裾、ユーザーが engine より green 収穫を望む場合): window6+ certify → 出荷。

## プロセス必須
- certify/難判断/gate5/設計レビュー agent は `model:'opus'`。engine 変更は骨格凍結例外 + **実装前 opus 3-lens 敵対設計レビュー** + 全gate。
- 1 タスク = 1 独立コミット。⚠ ブランチ名と実内容が乖離しないよう注意 (cluster15 はブランチ名 cutin-subtype のまま pivot した)。
- ⚠ Workflow 並列は SUB=5、1 workflow ずつ。smoke レポート (.claude/reports/smoke-*) は commit 対象外 (git add -A 後に `git reset .claude/reports/`)。
- Read hook がファイルを line1 で切る → Bash `cat -n` で読む / Edit 前に Read 1 回で登録。
- engine 拡張時: certify-brief.md (`.tmp/taskA/`) に新 capability の DSL レシピを追記してから certify (agent が新機構を知らないと yellow 誤判定)。

## 状態 doc
- cluster15 spec: `.claude/specs/engine-cluster15-contact-removal-observer-design.md` (§8 = v2 確定設計)
- defer: `.claude/specs/DEFERRED-INDEX.md` (cluster15 DEFER 14 rep + 新 gate cardName-EXCLUSION)
- スイープ正本: `.claude/specs/triage-sweep-2026-06-15.md` (gate ラベルは過剰グルーピング疑い、密度は実テキストで要検証)
- 詳細: memory.md セッション⑯ + sessions/2026-06-16.md
```

直近セッションは engine拡張 cluster15 (removal-observer 反撃カード一族) を実装前 opus 3-lens 敵対設計レビュー → 26枚出荷まで完遂 (全 gate green、push 済)。
cutin-subtype は sweep 誤ラベルと判明し contact-removal-observer に pivot。
**次セッションは partnerColorKeyword follow-up (FAST) / 次の密 engine クラスタ (要 homogeneity 検証) / batch#5 のいずれか。** `/clear` で新セッション推奨。
