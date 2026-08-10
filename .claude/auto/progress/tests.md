# 🤖 テスト進捗

> ⚠️ このファイルは `scripts/gen-docs/gen-progress.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:progress`
> Source hash: `29f588edf73b`

`tests/` 配下のテストファイル数を領域別に集計。最新の vitest 結果（あれば）も併記。

## テストファイル数

| 領域 | ファイル数 |
| --- | ---------- |
| `ai` | 26 |
| `cards` | 514 |
| `compiler` | 11 |
| `engine` | 211 |
| `factory` | 5 |
| `integration` | 7 |
| `meta` | 13 |
| `root` | 2 |
| `scripts` | 19 |
| `smoke` | 2 |
| `ui` | 61 |
| **合計** | **871** |

## 最新 vitest 実行サマリ

> ⚠️ `.tmp/vitest-summary.json` が見つかりません。
> 詳細な PASS/FAIL 数を表示するには次のコマンドを実行してください:

```sh
npx vitest run --reporter=json --outputFile=.tmp/vitest-summary.json
npm run docs:progress
```

---

## ソース

- [`tests/`](../../../tests/)
