# .claude/bugs/ 運用ルール

本ディレクトリは全バグ・リスクを Obsidian Base 形式 (`BUG-XXX.md` ファイル単位)
で管理する。集約 view は `index.base` を Obsidian で開いて参照。

## ファイル命名

- `BUG-XXX.md` (3 桁 zero-pad、連番)
- `index.base` (Obsidian Base、view 設定)
- `README.md` (本ファイル、運用ルール)

## frontmatter 必須フィールド

```yaml
---
id: BUG-XXX
title: 短い summary (1 行)
severity: 重大 | 高 | 中 | 低
category: engine | engine-data | engine-listener | engine-feature-gap |
          ui-css-animation | ui-driver | ui-feature | ai | test-infra |
          ui-test-isolation | 仕様確認
status: 未着手 | 対応中 | 修正済 | 仕様外
round: Round X | Phase X | Cleanup Phase | etc
date_found: YYYY-MM-DD
date_fixed: YYYY-MM-DD (status=修正済 のみ、未着手では省略)
commit: <git short hash> (status=修正済 のみ)
reporter: claude | user | claude (Round X 中に発見) etc
---
```

## 本文セクション (未着手 / 対応中 の必須項目)

未修正 BUG は以下 5 セクションを **必ず** 備える:

1. **期待動作** — rules/XX 引用 or UI 想定挙動
2. **実動作** — 観測されたバグ挙動、再現手順、関連ファイル + 行番号
3. **関連ファイル** — bullet list
4. **RCA (Root Cause Analysis)** — 推定原因、複数案を併記可
5. **水平展開** — 同構造の他箇所への影響範囲調査結果

加えて以下が **推奨** (修正案が固まっている場合):

6. **修正案** — コード snippet または手順
7. **防止策** — 同種 bug 再発防止のテスト追加・運用ルール

## 修正済 BUG の本文

`status: 修正済` に遷移した BUG は、上記 5 セクション必須を緩和し、**summary
形式 (20 行未満)** で十分とする。理由: commit hash + commit message が一次
情報源として残っており、retroactive な再整形は工数大で見合わない (BUG-020〜
028 の運用判断)。

ただし以下のケースは修正済でも full 記述を残す:

- severity: **重大** だった bug (将来の deep-dive に備える)
- 公式ルールの解釈に関わった bug (同様の質問が再発する可能性)
- 水平展開で同種 bug を **複数件** 連鎖発見した bug (RCA pattern 記録)

## 運用フロー

1. **新規バグ発見時**: BUG-XXX.md を作成 (frontmatter + 5 セクション)
2. **修正完了時**: status を `修正済` に更新、`commit` フィールドに short hash
   追記、`date_fixed` セット
3. **水平展開で同種 bug 発見時**: 同 commit で修正 + 新規 BUG-XXX.md 追加 (元 BUG
   から `関連` リンク)
4. **Round / Phase 完了時**: session log に `index.base` view へのリンク掲載、
   範囲のバグ進捗を要約

詳細な RCA + 水平展開計画 hub は `.claude/specs/risk-and-bug-tracker.md`。

## 関連

- 本リポジトリの CLAUDE.md「リスク・バグ管理表 運用」セクション
- `.claude/specs/risk-and-bug-tracker.md` — 解説 hub
- `.claude/docs/user-request-clarifications.md` — 公式ルール再確認結果
- `.claude/specs/DEFERRED-INDEX.md` — 実装保留一覧
