# 🤖 テスト進捗

> ⚠️ このファイルは `scripts/gen-docs/gen-progress.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:progress`
> Source hash: `21bf1e92b7ea`

`tests/` 配下のテストファイル数を領域別に集計。最新の vitest 結果（あれば）も併記。

## テストファイル数

| 領域 | ファイル数 |
| --- | ---------- |
| `ai` | 20 |
| `cards` | 448 |
| `compiler` | 11 |
| `engine` | 159 |
| `factory` | 5 |
| `integration` | 7 |
| `meta` | 4 |
| `root` | 1 |
| `scripts` | 10 |
| `smoke` | 2 |
| `ui` | 46 |
| **合計** | **713** |

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
