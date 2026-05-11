# 01. カードデータの取得方法

## 重要発見: カードJSONがDOM内に埋め込まれている

公式カード検索ページの `<li data-index>` 各要素の中の
`<img data="{...JSON...}">` 属性に **完全なカードデータがJSON形式で埋め込まれている**。

OCRやスクレイピングではなく、`JSON.parse` で構造化データが直接取れる。

## エンドポイント

| URL | 用途 |
|-----|------|
| `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist` | 全カード（初期50枚表示） |
| `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist?package=CT-D11` | パッケージ別フィルタ |
| `https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/{main_path}` | カード画像 |

## パッケージ識別子（22種類）

| 種別 | コード範囲 | 数 |
|------|-----------|-----|
| Case-Booster | CT-P01 〜 CT-P09 | 9 |
| Case-StartDeck | CT-D01 〜 CT-D05 | 5 |
| Case-ThemeDeck | CT-D06 〜 CT-D11（最新） | 6 |
| PRカード | PR-01 | 1 |

## 取得実装方針

公式サイトのDOMから直接JSONを抽出する。Playwright必須（JS描画ページのため）。

```typescript
// 擬似コード
async function fetchPackageCards(pkgCode: string) {
  await playwright.navigate(
    `https://www.takaratomy.co.jp/products/conan-cardgame/cardlist?package=${pkgCode}`
  );
  return playwright.evaluate(() => {
    return Array.from(document.querySelectorAll('li[data-index] img[data]'))
      .map(img => JSON.parse(img.getAttribute('data')));
  });
}
```

## 取得頻度

- 初回: プロジェクト初期化時に一括取得
- 更新: 新弾発売時、カード修正時に再取得
- **実行時の都度フェッチではなく** ローカルキャッシュ運用（法務スタンスに準拠）

## ローカルキャッシュ場所（gitignore対象）

```
cards/                      # コード（公開可）
.cache/cards/              # JSONキャッシュ（gitignore）
.cache/images/             # 画像キャッシュ（gitignore）
```

## MVP対象デッキの実規模

| デッキ | ユニークID | 全カード（rarity違い含む） | 内訳 |
|--------|-----------|---------------------------|------|
| CT-D08 青の古城探索事件 | 17 | 26 | パートナー2 / キャラ12 / イベント2 / 事件1 |
| CT-D11 千速と重悟の婚活パーティー | 17 | 21 | パートナー2 / キャラ12 / イベント2 / 事件1 |

## 関連
- [02-card-schema-design.md](02-card-schema-design.md)
- [03-image-handling.md](03-image-handling.md)
- [04-folder-structure.md](04-folder-structure.md)
