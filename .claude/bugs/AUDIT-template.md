# BUG フォルダ AUDIT (YYYY-MM-DD)

月次 audit の雛形。AUDIT-2026-05-22.md を初版参考。
cron が使えない環境のため、CLAUDE.md §運用ルール の指示に従って手動実行。

## 実行手順

1. `npm run bug:trend` で 5 再発パターン × 月次表を生成
2. `npm run lint:bugs` で frontmatter enum 違反 0 を確認
3. `npm run lint:listener` で triggered ability 規約違反 0 を確認
4. `git log --since="YYYY-MM-DD" --grep="BUG-"` で対象期間の BUG fix commit
   を収集
5. 以下 5 セクションを記入し `.claude/bugs/AUDIT-YYYY-MM.md` 保存

## 集計

| Status | 件数 | 比率 |
|---|---|---|
| 修正済 | NN | NN% |
| 対応中 / 部分修正 / 調査済 | NN | NN% |
| 未着手 | NN | NN% |
| 見送り / 仕様外 | NN | NN% |

## 構造的品質ギャップ

| 項目 | 件数 | 該当 BUG |
|---|---|---|
| commit hash 未反映 | N | BUG-XXX, ... |
| RCA セクション欠落 | N | BUG-XXX, ... |
| 水平展開セクション欠落 | N | BUG-XXX, ... |
| 防止策セクション欠落 | N | BUG-XXX, ... |
| frontmatter 非標準値 | N | BUG-XXX, ... |

## 再発パターン分布

`npm run bug:trend` の出力を貼り付け:

| Cluster | 当月 | 累計 |
|---|---|---|
| side-channel | N | N |
| listener | N | N |
| ui-text | N | N |
| modal-stack | N | N |
| binding-ref | N | N |
| other | N | N |

## 教訓追加 (LESSONS-LEARNED.md 反映)

本月で発見された新パターンがあれば LESSONS-LEARNED.md に教訓 N として追記。
enforcement script の有無も明示:
- 教訓 N: <内容> → enforcement: `<script名>` または `(passive doc)`

## 推奨アクション

- 即時補填: <該当 BUG>
- 構造改善: <仕組み>
- 文化: <教訓の周知>

## 関連

- 前回 audit: [AUDIT-YYYY-MM (前月).md](AUDIT-YYYY-MM-DD.md)
- LESSONS-LEARNED: [LESSONS-LEARNED.md](LESSONS-LEARNED.md)
- BUG trend: `.claude/reports/bug-trend-YYYY-MM-DD.md`
