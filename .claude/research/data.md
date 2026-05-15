# カードデータ研究 (research/data)

カード情報の取得・保存・参照に関する設計判断。

## ファイル一覧

| # | ファイル | 内容 |
|---|----------|------|
| 01 | [01-card-data-source.md](data/01-card-data-source.md) | カードデータ取得元 (公式DB等) |
| 02 | [02-card-schema-design.md](data/02-card-schema-design.md) | カードスキーマ設計 (TypeScript型) |
| 03 | [03-image-handling.md](data/03-image-handling.md) | 画像取り扱い (法務・キャッシュ) |
| 04 | [04-folder-structure.md](data/04-folder-structure.md) | フォルダ構造設計 |

## 関連 specs

- [engine-api-card-shape](../../specs/engine-api-card-shape.md) — 02 の TS 型反映
- [cards-analysis/INDEX](../../specs/cards-analysis/INDEX.md) — 02 のスキーマでカード分析実施

## 関連 rules

- [02-deck-construction](../../rules/02-deck-construction.md) — デッキ40枚制約
- [28-errata](../../rules/28-errata.md) — エラッタ反映方針

## 関連 legal

- [legal/04-recommendation](../legal/04-recommendation.md) — 画像同梱禁止の法務根拠 (03 と紐づけ)

## ナビゲーション

- ↑ [HUB.md](../../../HUB.md)
- ↑ [research/](../)
