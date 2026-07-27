# 行026 開始可能性

記録日: 2026-07-27 JST

## 対象

- 行026: YOU `deck-1784115364915` vs CPU `deck-1785077234307`、Desktop P1。
- worklist行001--025、55組上三角、既存resume Gate定義は変更しない。

## 確認済み

- `main` は `829219d9` のまま。準備作業は `codex/row026-gate-prep` に隔離。
- BUG-274の公開fixture Escape回帰はfocused Playwrightでpass。
- 公開UI baselineでmulligan、手札使用、Next Hint、任意使用、相手へのアクション判断、証拠進行、CPU応答を確認。
- 表向きカードは都度、公開UI本文・公式カード本文・該当規則を照合する運用にした。

## Gate

1. `blocked-ui-rule-mismatch`: 公開UIで「自分7/7」「事件状態: 解決編」なのに「事件解決 ★勝利 / まだ」。事件解決をクリックせず停止。
2. mismatch解消後にfresh packetを生成する。

`npm run tcg:packet:build` は未解消項目がある間は失敗する。解消前に行026 matchを開始しない。

## 次の判断

規則/UI整合を確認・解消してからfresh packetを生成する。行026のworklist状態は `queued`。
