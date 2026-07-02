# Track B — cards:sync バッチ自動化 (公式 API → TSV → compiler gate を 1 コマンド化)

**Round/Phase**: 2026-07-02 Track B (steady-state 運用ツール)。engine 変更 0。

## `npm run cards:sync` 新設 — 公式 HP からのカードデータ取得を全自動化

ユーザー要望「バッチ起動 1 発で自動取得」。従来はセット名ハードコード + ct-d08/d11 別経路 (legacy
_regen.js) + 手動チェーンだった取得フローを統一:

- **`_fetch_all.cjs` 全面書換 (auto-discovery 化)**: package 指定なしで公式 API 全ページ crawl →
  カード側 `package` フィールドでセット分割。**新セット (ct-p10 等) はコード無変更で自動発見**
  (★NEW SET 報告付)。ct-d08/ct-d11 も同経路に統一 (regen 冪等性は実測 byte-identical で証明)。
- **安全策**: ページ retry x3 / 収集数 ≠ API total なら**書き込みゼロで abort** (部分 snapshot で
  TSV を壊さない) / 未知 package は `_unknown-api.json` 隔離 + warn / show_hide 異常も warn。
- **npm scripts**: `cards:fetch` (API→TSV) / `cards:sync` (fetch → tsv-corpus → dump-shipped →
  mine → oracle --gate まで連鎖 = エラッタ・誤訳 drift の自動 surface)。

## 初回実走の成果 (2074 枚 / 42 ページ crawl)

- **新カード +25 枚検出** = PR277〜PR304 (新プロモ)。既存カードのセル変更 **0** (エラッタなし、
  cardNum キー突合で機械証明)。TSV 並び順は API id 昇順に正規化 (一回限りの churn、以後 diff 最小)。
- **G1 gate green 維持**: shipped 1517 / match 1246 / mismatch 0 / conflicts 0 / exceptions 7。
- **unshipped compile 可 0 → 10 枚** (PR281/282/283 = whole-line 文法一致 + vanilla 7 枚) —
  card-wave (Track A) への即出荷候補 signal。

## gate

tsc 0 / vitest 3658+1skip 全 green / smoke:1000 winsA=498 timeouts=0 exceptions=0 /
compiler suite 68/68 / rules 655 不変。T1 (tool code、機械ゲートのみ)。
