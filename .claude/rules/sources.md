# 公式出典

このルール集の参照元。
**新ルール・カード追加時はここから再フェッチして更新すること。**

## 一次情報源 — 公式PDF

| 名称 | バージョン | URL | ローカル抽出 |
|------|------------|-----|-------------|
| オフィシャルルールマニュアル | Ver 2.5 (27p) | https://www.takaratomy.co.jp/products/conan-cardgame/pdf/rule/rule_manual.pdf | `.tmp/floor_rule/rule_manual.{pdf,txt}` / `.tmp/floor_rule/manual_pages/page_NN.txt` |
| フロアルール | Ver 1.36 (21p / 2026-04-25) | https://www.takaratomy.co.jp/products/conan-cardgame/pdf/rule/floor_rule.pdf | `.tmp/floor_rule/floor_rule.{pdf,txt}` |
| プレイシート | (画像主体) | (DCinsert_playsheet.pdf) | `.tmp/floor_rule/playsheet.{pdf,txt}` / `.tmp/playsheet_png/` |
| カード制限リスト | 適用日付随時 | https://www.takaratomy.co.jp/products/conan-cardgame/card_limit/limit/ | rules/[27-card-restrictions.md](27-card-restrictions.md) |
| エラッタ | 全7件 | https://www.takaratomy.co.jp/products/conan-cardgame/errata | rules/[28-errata.md](28-errata.md) |

## 二次情報源 — 公式キュレーションWiki

タカラトミー公認コミュニティ「名探偵コナンTCGカードルール相談コミュニティ」(commmune.com) 内：

| 名称 | URL | 信頼度 |
|------|-----|--------|
| 総合ルールWiki トップ | https://conan-tcg.commmune.com/view/box?boxId=knowledgeBase001 | 高 |
| ゲーム用語Wiki（用語五十音索引） | https://conan-tcg.commmune.com/view/knowledgebase/post/16876 | 高 |
| 公式投稿Q&A | https://conan-tcg.commmune.com/view/box?boxId=talk002 | 高 |
| ユーザー投稿Q&A | https://conan-tcg.commmune.com/view/box?boxId=RlRLHa8Pp | 補助のみ |

公式Wikiにはルールマニュアル Ver.2.4 全27ページが個別記事として転載されている。
PDFが読めない環境ではこちらを参照可能。

## 公式サイト

| 名称 | URL |
|------|-----|
| 公式トップ | https://www.takaratomy.co.jp/products/conan-cardgame/ |
| カード検索 | https://www.takaratomy.co.jp/products/conan-cardgame/en/cardlist/ |
| 製品一覧 | https://www.takaratomy.co.jp/products/conan-cardgame/product/ |
| 公式X | https://twitter.com/CONAN_tcg |

## 三次情報源（補助）

公式が解釈困難な場合の補助参照のみ。公式と矛盾する場合は **公式優先**。

| 名称 | URL |
|------|-----|
| トレカの地図 ルール解説 | https://torecamap.co.jp/column/conan-rule/ |

## 取得・更新履歴

- 2026-08-13: 一次情報を再取得し、内容と取得バイト列を固定
  - ルールマニュアル Ver 2.5 (27p): SHA-256 `2a3caf3372e66656cd9ac0c5ba9dc8fc4177c176317f4f97086975c1c9e65d41`
  - フロアルール Ver 1.36 (21p): SHA-256 `b71650d9e463c64fc4a7384107b3efed913685531e3bcb9dd3aed92ace5a1d00`
  - カード制限リスト: SHA-256 `9efdfa51ef55205607a5c26295020d75624910004187eca5ace9c954897a16e8`
  - エラッタ（7件）: SHA-256 `2f61606a9f7f61f0d2531a30edd4652eb6e0e9d3a70f31b667df48ba1d432764`
- 2026-07-27: 公式PDF Ver 2.5を確認（Last-Modified: 2026-07-24、SHA-256: `2a3caf3372e66656cd9ac0c5ba9dc8fc4177c176317f4f97086975c1c9e65d41`）
- 2026-05-10: 初回フェッチ
  - PDF Ver 2.4 全27ページ抽出
  - Wiki構造把握、用語索引取得
- 2026-05-10 (再検証):
  - **rule_manual.pdf を実体ダウンロード**（10.5MB、PDFテキスト抽出可能と判明）
  - 全27ページのテキストを抽出 → 既存 rules/01-26 と突合
  - 漏れ3件（LP≤0で証拠0枚 / 解決編→事件編不可 / AP・LP・レベルに下限なし）を反映
  - commmune ナレッジベース全27ページは PDF の画像転載のみと確認
  - 用語Wiki(post/16876)はインデックス専用と確認、新規定義テキスト無し
  - 事件編／解決編マーカーを 06-card-types.md に追加

## 著作権・利用上の注意

- 公式テキスト・画像の **直接コピー** は本リポジトリにコミットしない
- ルール解釈・カード効果の **要約のみ** を保存する
- カード画像は公式URLから都度フェッチする運用とする
