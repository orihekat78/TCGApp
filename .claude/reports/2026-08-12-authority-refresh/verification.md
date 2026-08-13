# 2026-08-12 card authority refresh verification

## 結果

- 公式カード取得済みpacketをネットワーク再取得せず、現行parserで再導出した。
- 2回取得済みraw 22 filesは元packetとbyte一致。全112 artifactsをmanifestで再検証した。
- 2,240→2,256印刷。追加PR305〜PR320、削除0、既存6印刷の公式field更新。
- Q&Aは2,912→2,964、conflict 0、曖昧remap 0。
- 承認1,450件をreview digestへ固定し、共有write lock下でcards-data rootを原子的置換した。

## 意味レビュー

- 543 removed Q&Aは全件、同じcardId+questionHashのaddedへ一意に対応。
- 511件はsection ID移動のみ。32件はsection移動と見出し除去。
- stable IDの289件は、次のQ見出しを前回答へ誤連結していた旧parser由来の機械差分。
- 意味変更はB04018の1件。能力は保持するが印字テキストが有効でない、という公式Q&Aへ更新。
- 新規Q&Aは52件。既存rules/engineのoriginal-ability判定は新裁定と整合。

## 検証

- `validateAuthorityPacket`: PASS
- `validatePublishableAuthorityPacket`: PASS、added 16 / changed 6 / qa 1,428
- `npm run cards:authority:publish -- --packet <external> --approval <external>`: PASS
- source packet SHA-256: `b02e6216325fce07d3b5a847d6b6d7781217a4b5130999d059cb3f98a164a5d3`
- rederived packet SHA-256: `22dc2305a340b834c724f2c4a150c0b36132ee5af8941be2532a5f2d01fa93bd`
- review digest: `c722224a810717a1391944f771e87d3615bd85ad9a323241593cd29ae7fec7b6`
- approval SHA-256: `8e6d305521b789a0e779d4afcaeafb53e328fea188284552eb508a1cd2701bff`
- raw/TSV card number SHA-256: `6f3ca95ca50041ee79478994cde9124cc18a743052d3a5a6fef564c791e95df4`
- normalized FAQ SHA-256: `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`

詳細な件数・集合digestは `diff.json`。公式本文・Q&A本文はreportへ複製していない。
