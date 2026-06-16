# 次セッション再開プロンプト (2026-06-16 cluster16 Commit2 出荷完了 — 11枚出荷、ALL_CARDS 1338)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (設計レビュー / 意味等価突合 / 敵対反証 / certify) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **応答は日本語で** (memory feedback-respond-in-japanese)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-16、cluster16 Commit2 出荷完了、ALL_CARDS=1338)

直近セッション⑱で cluster16 engine (cardNameNot + deckReveal filterAny) を使うカードを opus 再 certify → **GREEN のみ pure-JSON 11枚出荷**
(branch cards/wave2-cluster16-ship、main push 済 + CI 確認)。全 gate green (vitest 5190 / smoke baseline winsA=498 不変 / gate5 14 pass)。
詳細は memory.md セッション⑱。

## ★最優先候補 (いずれか、ユーザー選択)

1. **萩原千速 pair 手 author 出荷** (PR280/B06087/B06087P): certify GREEN だが pure-JSON codegen 不可で DEFER した。出荷に必要な手作業は
   既に分析済み — (a) a2 は auto-spec が存在しない `triggerCondition` フィールドで **over-fire バグ**。正解は
   `condition: and[{fileAtLeast:6}, {removedCharMatches, side:'opp', cause:'contact-ap', by:'self'}]` (cluster15 D09010 と同型)。
   (b) a1 は `partnerColorKeyword({color:'黄', kw:'突撃', abilityId:'a1'})` を __shared TS import で。
   (c) **初の自己リムーブ removal-observer** = novel re-entrancy。engine トレースで安全確定済 (handleHook が effect を event.queue で
   deferred 化、自己除去の再emit cause:'effect'/side:own は observer 条件 {side:opp,cause:contact-ap} に再合致せず cascade 不能) だが
   **専用 gate5 end-to-end テスト** (contact 除去→observer→自己除去→summon、cardNameNot で別の萩原千速を手札 decoy に置き除外確認) を必ず書く。
   同梱: **B07051** (桃井恵子、sweep が B03016 clone に誤 grouping した別カード = 怪盗キッド/高校生 reveal、同 G2 capability で出荷可、要 certify)。

2. **partnerColorKeyword closure DEFER 群の __shared 手 author fast follow-up**: B06038/B06039/B08010/B09071/B04004 等。a1 が
   partnerColorKeyword closure (JSON 不能) のため codegen 対象外だが、反撃/他句は green。__shared TS import で手 author 出荷。

3. **次 engine クラスタ** or **トリアージ出荷バッチ#5**: スイープ正本 `.claude/specs/triage-sweep-2026-06-15.md` (gate ラベルは
   過剰グルーピング、密度は実テキスト決定論分類で必ず検証 — cutin-subtype/cluster16 の教訓)。

## プロセス必須 (セッション⑱の教訓)
- **certify auto-spec を信用しすぎない**: verify pass でも shared-class を非codegen形式 (PR280 `__sharedClass`文字列 / B03053 inline
  icon-misread) で出す + 存在しないフィールド (`triggerCondition`) で over-fire バグを出す。**出荷前に全 spec を shipped exemplar と
  自己突合必須** (matchOneFilter/deckReveal の filter 値、chain/condition 構造、shared-class は `{__shared, args}` 形式か)。
- certify/難判断/gate5 agent は `model:'opus'`。⚠ Workflow 並列は SUB=5、1 workflow ずつ (rate-limit 回避)。
- 出荷後の全 gate: validate-specs / tsc / vitest (baseline 減なし) / smoke baseline 不変 / **gate5 (実 filter 値を decoy で
  「画面処理=テキスト文言」1対1)** / lint:* 8本。playwright は CI 委譲可 (UI/engine 変更なし時)。
- ⚠ commit は Bash で `git commit -F - <<'EOF'` (PowerShell の `@'...'@` を Bash で使うと `@` 混入)。
- 1 タスク = 1 commit。smoke レポートは `git add -A` 後 `git reset .claude/reports/` で除外。
- Read hook がファイルを line1 で切る → Bash `cat -n` で読む / Edit 前に Read 1 回で登録。

## 状態 doc
- cluster16 spec: `.claude/specs/engine-cluster16-filter-predicate-expressiveness-design.md`
- certify 正本: `.tmp/taskA/certify-brief.md` (§cluster16 反映済) + `.claude/specs/catalog-survey-2026-06-06/capability-map.txt`
- defer: `.claude/specs/DEFERRED-INDEX.md` (cluster16 セクション = PR280pair/B09016/B07051)
- 詳細: memory.md セッション⑱ + sessions/2026-06-16-2.md (⑮⑯⑰)
```

直近セッション⑱は cluster16 capability を使うカード 9 候補を opus 再 certify → GREEN 7 のうち pure-JSON 6 reps + 5 clones = **11枚出荷**。
萩原千速 pair (auto-spec の over-fire バグ + partnerColorKeyword closure + novel re-entrancy) と B09016 (ミスリード反応 hook 欠落) は DEFER。
certify auto-spec のバグを自己精査で複数捕捉 (verify 透過) したのが最大の教訓。**次セッションは上記候補から1つ着手。** `/clear` 推奨。
