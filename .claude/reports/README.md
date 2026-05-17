# .claude/reports

Phase 9-A 以降の自動計測レポート置き場。`scripts/smoke/run-1000.ts` が生成する成果物を保存する。

## ファイル命名規則

```
smoke-YYYY-MM-DD.json   ── 機械可読 (schema 詳細は scripts/smoke/aggregate.ts 参照)
smoke-YYYY-MM-DD.md     ── 人間向けサマリ
```

同日 2 回目以降は suffix `-2`, `-3` を付与。既存ファイルは上書きしない (履歴保護)。

## 実行

```bash
# 全 1000 戦
npx tsx scripts/smoke/run-1000.ts

# 単一 seed の再現実行 (異常 seed の調査用)
npx tsx scripts/smoke/run-1000.ts --seed=smoke-42
```

実行時間目安: 5〜10 分 (heuristic × heuristic / 3 deck pairing / 1000 戦合計)。

## 比較・分析

新カード追加や engine 変更後、本ディレクトリの最新レポートと前回レポートを比較して
劣化検知 (勝率の極端な偏り / timeout 増加 / exception 増加) を行う。

## 関連

- [scripts/smoke/run-1000.ts](../../scripts/smoke/run-1000.ts) — runner 本体
- [scripts/smoke/aggregate.ts](../../scripts/smoke/aggregate.ts) — 集計ロジック (pure)
- [scripts/smoke/format-md.ts](../../scripts/smoke/format-md.ts) — Markdown 整形 (pure)
- [tests/smoke/](../../tests/smoke/) — pure 関数の単体テスト
