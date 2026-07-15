# 🤖 テスト進捗

> ⚠️ このファイルは `scripts/gen-docs/gen-progress.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:progress`
> Source hash: `cf0fdfa65c24`

`tests/` 配下のテストファイル数を領域別に集計。最新の vitest 結果（あれば）も併記。

## テストファイル数

| 領域 | ファイル数 |
| --- | ---------- |
| `ai` | 20 |
| `cards` | 445 |
| `compiler` | 9 |
| `engine` | 151 |
| `factory` | 5 |
| `integration` | 7 |
| `meta` | 1 |
| `root` | 1 |
| `scripts` | 1 |
| `smoke` | 2 |
| `ui` | 45 |
| **合計** | **687** |

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
