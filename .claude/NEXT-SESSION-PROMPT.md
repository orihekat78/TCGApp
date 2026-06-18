# 次セッション再開プロンプト (2026-06-18 セッション⑳ 完了 — 桃井恵子 B07051 出荷、ALL_CARDS 1342)

> モデル方針: `claude-fable-5` が agent で利用不可のため、本体も難判断も **opus を最初から**。難判断 agent
> (certify / 意味等価突合 / 敵対反証 / gate5) は `model:'opus'` 明示。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔化、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-18、main=セッション⑳ commit、ALL_CARDS=1342、CI green)

セッション⑳で cluster16 G2 残 follow-up の **桃井恵子 B07051 を certify→出荷** (branch
cards/wave2-cluster16-momoi-b07051 → main ff-merge)。出荷済 B03016 円谷光彦 の文字単位 twin
(阿笠博士→怪盗キッド / 少年探偵団→高校生 の leaf literal 2箇所のみ) として手 author。
gate5 `tests/cards/B07051-momoi-deckreveal.test.ts` 9 pass (filter を outcome[手札/デッキ下]で1対1証明、
kind:character 違反 event decoy 含む) + 敵対 certify (opus, ship:true)。詳細は memory.md セッション⑳。

## ★最優先候補 (いずれか、ユーザー選択)

1. **partnerColorKeyword closure DEFER 群 fast follow-up**: B06038/B06039/B08010/B09071/B04004 等。
   反撃句は green だが a1 が partnerColorKeyword closure で codegen 不可 → __shared TS import で手 author 出荷
   (萩原 trio / B07051 と同手順)。DEFERRED-INDEX cluster15 セクション参照。

2. **次 engine クラスタ / トリアージ出荷バッチ#5**: スイープ正本 .claude/specs/triage-sweep-2026-06-15.md
   (gate ラベルは過剰グルーピング、密度は実テキスト決定論分類で必ず検証)。

3. **B09016 (円谷光彦・別版)**: cluster16 残の yellow (engine gate)。「ミスリードしたとき」反応 trigger が
   card-triggerable hook に無く engine 変更必須 → 着手は engine 拡張判断を要する。

## プロセス必須 (card-wave skill + 教訓)
- **手 author clone は exemplar との diff を取り leaf literal 差替のみ**であることを確認 (B07051 は B03016 と byte-identical 構造)。
- **certify auto-spec を信用しすぎない**: ⑲ PR280 auto-spec は engine 非実在 `triggerCondition` で over-fire (verify 透過)。
- **filter は DSL に書いても engine 実評価の保証なし** (BUG-117/118)。gate5 は decoy を outcome で 1対1 検証。
  「のキャラ」= kind:character / 「のカード」= kind 無し を decoy で固定 (event decoy で kind 制約を証明)。
- `canDeclaredAbility` は cost.canPay を gate しない (存在/limit/condition のみ)。sleep cost gate は `engine.cost.canPay`。
- certify/難判断/gate5 agent は model:'opus'。⚠ Workflow 並列は SUB 控えめ・1 workflow ずつ (rate-limit 回避)。
- 出荷後ゲート: tsc / vitest (baseline 減なし) / smoke baseline 不変 / gate5 / lint。非MVPは playwright 不可→gate5 vitest 代替。CI で回帰確認。
- ⚠ commit は Bash heredoc。1 タスク=1 commit。smoke レポート・.gitignore(.superpowers/) は明示 add から除外。
- pre-commit docs:check が未再生成でブロック → npm run docs で同期 (--no-verify 禁止)。
- Read hook がファイルを line1 で切る → Bash cat / Edit 前に Read 1 回で登録。

## 状態 doc
- defer: .claude/specs/DEFERRED-INDEX.md (萩原 trio + B07051 = ✅出荷済、B09016 が cluster16 残)
- certify 正本: .tmp/certify/ (durable) + .tmp/taskA/certify-brief.md
- cluster16 spec: .claude/specs/engine-cluster16-filter-predicate-expressiveness-design.md
- 詳細: memory.md セッション⑳
```

セッション⑳は桃井恵子 B07051 を出荷 (ALL_CARDS 1342、CI green)。**次は上記候補から1つ着手。** `/clear` 推奨。
