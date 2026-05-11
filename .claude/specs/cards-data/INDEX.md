# cards-data — カードデータ TSV (権威ソース)

カードのメタデータ + 公式テキスト効果を **本ディレクトリの TSV を権威ソース** とする。
カード分析 md ([cards-analysis/](../cards-analysis/)) は **能力分解 (DSL化) と パターン解析** に特化し、
メタ・テキストは TSV を参照する (md内に複製しない)。

## ディレクトリ構成

```
cards-data/
├── INDEX.md (本ファイル)
├── _regen.js (元 JSON から TSV を再生成するスクリプト)
├── ct-d08/
│   ├── partner.tsv     (2枚)
│   ├── character.tsv   (21枚)
│   ├── event.tsv       (2枚)
│   └── case.tsv        (1枚)
└── ct-d11/
    ├── partner.tsv     (2枚)
    ├── character.tsv   (16枚)
    ├── event.tsv       (2枚)
    └── case.tsv        (1枚)
```

## TSV スキーマ (kind 別)

不要列は kind ごとに削除している。

| kind | 列構成 |
|------|--------|
| partner | cardNum, cardId, title, color, lp, rarity, features, imagePath, effect, illustrator, qAndA |
| character | cardNum, cardId, title, color, level, ap, lp, rarity, features, imagePath, effect, cutIn, hirameki, henso, illustrator, flavor, qAndA |
| event | cardNum, cardId, title, color, level, rarity, imagePath, effect, cutIn, hirameki, illustrator, flavor, qAndA |
| case | cardNum, cardId, title, color, rarity, imagePath, difficultyFirst, difficultySecond, effect, illustrator, qAndA |

### 列の意味

| 列 | 説明 |
|----|------|
| cardNum | DXXNNN — 一意キー |
| cardId | 同名カード共有ID (絵柄違いで同 cardId、rules/02 同カード判定はこちら) |
| title | カード名 |
| color | 色 (青/黄/赤/緑) |
| level | レベル (元 JSON では `cost` 名で出現するが、ゲーム上は「レベル」) |
| ap | 攻撃力 |
| lp | LP (推理時の証拠獲得枚数) |
| rarity | レアリティ (D/R/SR/MR/PR等) |
| features | 特徴 (パイプ区切り 例: `探偵\|少年探偵団`) |
| imagePath | 公式画像ファイル名 (リポジトリ非同梱、実行時フェッチ) |
| difficultyFirst/Second | 事件カードの難易度 = 必要証拠数 (rules/01 = 7/6) |
| effect | 効果テキスト (改行は `\n` でエスケープ) |
| cutIn | カットインテキスト |
| hirameki | ヒラメキテキスト |
| henso | 変装テキスト |
| illustrator | イラストレーター名 |
| flavor | フレーバーテキスト |
| qAndA | 公式 Q&A 裁定 (タカラトミー公式サイトの「カード詳細」由来) |

### TSV エスケープ規則

- 改行 (`\n`/`\r\n`/`\r`) → 文字列 `\n`
- タブ (`\t`) → 文字列 `\t`
- バックスラッシュ (`\`) → 文字列 `\\`
- 読み込み側で逆エスケープすること

## データソース

- `_raw/ct-d08-api.json` / `_raw/ct-d11-api.json` — 公式 API レスポンス キャッシュ
- 取得元: `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1&package=CT-D08` (ページング: page=1,2,...)
- 再フェッチ: 上記 URL を curl で取得し `_raw/` へ保存後 `node _regen.js`
- API レスポンスのキー対応:
  - `feature` → effect, `cut_in` → cutIn, `category1/2/3` → features (joined `|`)

## 規約

1. **メタデータ・公式テキストの編集は TSV のみ**。md 側の冒頭は TSV 行へのポインタ
2. 元データ更新は `_raw/*.json` 再フェッチ → `node _regen.js`
3. 同 cardId 複数 (絵柄違い) は別行として保持
4. TSV 列削除/追加は本 INDEX のスキーマも更新

## 関連

- [../cards-analysis/INDEX.md](../cards-analysis/INDEX.md) — 効果分析 (能力分解)
- [../cards-analysis/TEMPLATE.md](../cards-analysis/TEMPLATE.md) — 分析テンプレ
- [../engine-api-card-shape.md](../engine-api-card-shape.md) — CardDef 型
