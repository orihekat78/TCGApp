# 04. カードデータのフォルダ構成

## 階層方針（ユーザー指示準拠）

**カード種類を一次分類、弾/デッキを二次分類** で構成する。

```
cards/
├── partner/                 # ★ 一次分類: カード種類
│   ├── CT-P01/             # 二次分類: 弾/デッキ
│   ├── CT-P02/
│   ├── ...
│   ├── CT-D08/             # 青の古城探索事件
│   │   ├── D08001.ts       # 江戸川コナン（パートナー）
│   │   └── D08001.meta.json
│   └── CT-D11/
│       └── D11001.ts       # 千速（パートナー）
├── chara/
│   ├── CT-P01/
│   ├── CT-D08/
│   │   ├── D08002.ts
│   │   └── ...
│   └── CT-D11/
├── event/
│   ├── CT-P01/
│   └── CT-D11/
│       └── D11019.ts       # 15の受難
└── case/
    ├── CT-D08/
    │   └── D08026.ts       # 青の古城探索事件
    └── CT-D11/
        └── D11021.ts       # 千速と重悟の婚活パーティー
```

## カード種類のディレクトリ命名

| 公式表記 | ディレクトリ | 略称 |
|----------|-------------|------|
| パートナー | `partner/` | P |
| キャラ | `chara/` | C |
| イベント | `event/` | E |
| 事件 | `case/` | (none) |

## ファイル命名規則

ファイル名は **印刷番号 (`card_num`)** ベース：

- `D08001.ts` — 効果ロジック（TypeScript）
- `D08001.meta.json` — 公式メタ情報の生データ
- `D08001.qa.md` — カード固有のQ&A裁定（公式から取得した `q_a` フィールドを整形）

## レアリティ違いの扱い

同じ `card_id` でレアリティ違いがある場合（例: P001 に B01001 / B01001P / B01001Sec1 が存在）：

- **効果ロジック (`*.ts`) は1ファイルにまとめる**（card_id 単位）
- **メタJSON (`*.meta.json`) は印刷番号ごとに別ファイル**（画像参照のため）

```
partner/CT-P01/
  P001.ts                       # 効果（1つ）
  P001.B01001.meta.json         # C版メタ
  P001.B01001P.meta.json        # CP版メタ
  P001.B01001Sec1.meta.json     # SEC版メタ
```

## インデックス自動生成

ビルド時にインデックスを自動生成:

```
cards/
├── _index/
│   ├── all.ts             # 全カードの一覧（型: CardMeta[]）
│   ├── byPackage.ts       # パッケージ別
│   └── byCardId.ts        # card_id別
```

これにより、エンジン側は `import { allCards } from 'cards/_index/all'` で参照可能。

## キャッシュとの関係

```
cards/                      # コード（公開）
├── partner/CT-D08/D08001.ts                # ✓ 公開可（効果ロジック）
├── partner/CT-D08/D08001.B01001.meta.json  # ※ 要検討
└── ...

.cache/                     # 自動取得・gitignore
├── meta/CT-D08.json        # 公式から取得した生JSON
├── images/                 # カード画像
│   └── 1743743093420786.jpg
└── qa/                     # カードQ&A
```

メタJSONはコードに含めず、`.cache/` から起動時にロードする方針も検討（法務スタンスの徹底）。

## 関連
- [02-card-schema-design.md](02-card-schema-design.md)
- [03-image-handling.md](03-image-handling.md)
