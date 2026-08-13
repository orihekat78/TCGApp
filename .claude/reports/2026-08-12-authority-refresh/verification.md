# 2026-08-12 card authority refresh verification

## 結果

- 公式カードを再取得せず、review済みraw packetを現行parserで再導出した。
- raw 22 filesはsource packetとbyte一致。112 artifactsをmanifestで再検証した。
- 2,240から2,256印刷へ更新。追加PR305からPR320、削除0。
- Q&Aは2,912から2,964。conflict 0、曖昧remap 0。
- Q&A adjudicationは2,964件すべてreview済み。`unreviewedCount: 0`。
- 実動作assertion結線は478件。今回13件を追加し、残る`test-gap`は2,486件。
- 同一Q&Aはexact hash cluster単位でまとめる。本文が似るだけの項目は一括承認しない。

## 意味レビュー

- 543 removed Q&Aは全件、同じ`cardId + questionHash`のaddedへ一意対応した。
- 511件はsection ID移動のみ。32件はsection移動と見出し除去。
- stable IDの289件は旧parser由来の機械差分。
- 意味変更はB04018の1件。能力は保持するが印字テキストは無効、という公式Q&Aへ更新。
- 新規Q&Aは52件。カード、rules、engine、テスト証拠へ結び付けた。

## 検証

- `validateAuthorityPacket`: PASS
- `validatePublishableAuthorityPacket`: PASS
- `npm run cards:authority:publish -- --packet <external> --approval <external>`: PASS
- `npm run cards:authority:ground -- --packet <fresh-external>`: PASS
- grounding対象: `PR305`から`PR320`の16印刷
- grounding output: packet/project外のexternal temp
- grounding入力stage: SHA/identity固定、処理後はexternal residueとしてpathをreceiptへ記録
- grounding前後のsource packet SHA-256一致。処理後`validateAuthorityPacket`: PASS
- empty-added packet: child非起動の安全なno-opをfocused testで確認
- authority grounding最終査読: Critical 0 / Important 0
- authority/snapshot focused tests: 105/105 PASS
- Q&A merge/local verification/`lint:qa --require-reviewed`: PASS
- `cards:check:live-status`: 2,256件。card/FAQ hash driftなし

## Digests

- source packet SHA-256: `b02e6216325fce07d3b5a847d6b6d7781217a4b5130999d059cb3f98a164a5d3`
- rederived packet SHA-256: `22dc2305a340b834c724f2c4a150c0b36132ee5af8941be2532a5f2d01fa93bd`
- review digest: `c722224a810717a1391944f771e87d3615bd85ad9a323241593cd29ae7fec7b6`
- approval SHA-256: `8e6d305521b789a0e779d4afcaeafb53e328fea188284552eb508a1cd2701bff`
- raw/TSV card number SHA-256: `6f3ca95ca50041ee79478994cde9124cc18a743052d3a5a6fef564c791e95df4`
- normalized FAQ SHA-256: `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`

詳細な件数と集合digestは同ディレクトリの`diff.json`を参照。公式本文やQ&A本文はreportへ複製しない。
