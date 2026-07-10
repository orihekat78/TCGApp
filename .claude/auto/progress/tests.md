# 🤖 テスト進捗

> ⚠️ このファイルは `scripts/gen-docs/gen-progress.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:progress`
> Source hash: `5db7d08db7fa`

`tests/` 配下のテストファイル数を領域別に集計。最新の vitest 結果（あれば）も併記。

## テストファイル数

| 領域 | ファイル数 |
| --- | ---------- |
| `ai` | 18 |
| `cards` | 342 |
| `compiler` | 9 |
| `engine` | 136 |
| `factory` | 5 |
| `integration` | 7 |
| `root` | 1 |
| `smoke` | 2 |
| `ui` | 40 |
| **合計** | **560** |

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
