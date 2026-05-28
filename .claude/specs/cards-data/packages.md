# cards-data パッケージ一覧

2026-05-26 取得時点。全 19 パッケージ・2049 枚を `cards-data/` 配下に TSV で保持。
取得手順は [INDEX.md](INDEX.md) を参照。

## パッケージ別カード数

| パッケージ | 名称 | 枚数 |
|-----------|------|------|
| CT-D01 | Case-StartDeck 01 江戸川コナン | 16 |
| CT-D02 | Case-StartDeck 02 服部平次 | 16 |
| CT-D03 | Case-StartDeck 03 怪盗キッド | 16 |
| CT-D04 | Case-StartDeck 04 赤井秀一 | 16 |
| CT-D05 | Case-StartDeck 05 安室透 | 16 |
| CT-D06 | Case-ThemeDeck 01 服部平次VS怪盗キッド | 24 |
| CT-D07 | Case-ThemeDeck 02 黒ずくめの組織 | 24 |
| **CT-D08** | **Case-ThemeDeck 03 青の古城探索事件 (MVP)** | **26** |
| CT-D09 | Case-ThemeDeck 04 死亡の館、赤い壁 | 27 |
| CT-D10 | Case-ThemeDeck 05 シャッフルロマンス | 26 |
| **CT-D11** | **Case-ThemeDeck 06 千速と重悟の婚活パーティー (MVP)** | **21** |
| CT-P01 | Case-Booster 01 探偵たちの切札（ジョーカー） | 160 |
| CT-P02 | Case-Booster 02 西と東の大決戦（コンタクト） | 149 |
| CT-P03 | Case-Booster 03 黒影の襲来（カットイン） | 205 |
| CT-P04 | Case-Booster 04 信義の絆（パートナー） | 148 |
| CT-P05 | Case-Booster 05 新たなる謎 | 188 |
| CT-P06 | Case-Booster 06 交錯する刃 | 184 |
| CT-P07 | Case-Booster 07 魅惑のマジック | 175 |
| CT-P08 | Case-Booster 08 哀色の宿命 | 145 |
| CT-P09 | Case-Booster 09 疾風の煌めき | 188 |
| PR-01 | プロモーションカード | 279 |
| **合計** |  | **2049** |

## 注意

- MVP 実装スコープは **CT-D08 / CT-D11 のみ**。それ以外のパッケージは
  メタデータ保持のみで、`src/cards/` 配下に実装は **無い** (将来スコープ)。
- カード画像 (imagePath 列) は実行時フェッチで使用。リポジトリ非同梱。
- PR-01 (プロモ) は他パッケージで配布されたカードの再録を含むため、
  `cardId` が他パッケージと重複するケースがある (絵柄違い同一カード)。
