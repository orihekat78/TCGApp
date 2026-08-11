# 07 — カード管理経路 (DECK 編集 / CARDS)

## DeckEditor

### 採用案: 3 カラムレイアウト
`design-mockups_v2/06-deck-3col.jsx` を採用 (Master Duel 風スプレッドの `06-deck-md.jsx` は将来 Phase 11 で検討)。

### Props / 状態
- props: `deckId?: string` (URL クエリ `#deck?id=xxx` で渡す。新規なら未指定)
- 内部 state: `currentDeck: DeckRecord` (持ち回り)
- 読み取り: `engineStub.cards.all()`, `engineStub.decks.byId(deckId)`
- 書き出し: 「保存」 → `engineStub.decks.add/update`

### レイアウト (3 カラム)
- 左カラム (300px): フィルター (色 / 種別 / コスト / 特徴 / キーワード) `<FilterGroup>` 縦並び
- 中央カラム (flex): カードプールグリッド (フィルター結果, MetaCard 大)
- 右カラム (380px): 現在のデッキリスト (40 枚, 枚数表示) + パートナー枠 + 検証バナー
  - `<WarningBanner>` で `engineStub.cards.validateDeck()` 結果表示

### 操作
- カードプール → カードクリック → デッキへ +1 (同 ID 3 枚上限)
- デッキリスト → カードクリック → -1
- 「保存」: 検証エラーなしの場合のみ activate (40 枚 / ID制限 / パートナー1枚)
- 「テスト対戦」: 検証 OK なら #setup へ + currentDeck を SetupScreen に渡す

### F-rule-audit 反映
- 「事件レベル 4」表記の削除 (検証バナー含む)
- パートナー / 事件はデッキカウントに含めない (`02-deck-construction.md` 準拠)

---

## CardsScreen

### Props / 状態
- props: `initialFilter?: { color?: string; kind?: string }` (optional)
- 読み取り: `engineStub.cards.all()`, `engineStub.decks.list()` (採用集計用)
- 書き出し: なし (お気に入り機能は将来 Phase 11)

### レイアウト (`design-mockups_v2/08-cards.jsx` 準拠)
- 上部: TopBar + フィルター行 (色 / 種別 / コスト / 特徴 / キーワード)
- メイン: カードグリッド (CARD_POOL 47 枚, MetaCard 中サイズ)
- 右サイド: カード詳細パネル (選択カードのフルテキスト, AP/LP/Lv, キーワード, 採用デッキ数)

### 採用デッキ集計
```ts
const usageCount = decks.filter(d => d.cards.some(c => c.num === selectedCard.num)).length;
```

`design-mockups_v2/memory.md` 残作業候補に「現在は固定値 3/4」とあるため、本実装で実値表示に修正。

### キーワード抽出表示
- カード詳細の「キーワード」セクションに、効果テキストから抽出した突撃 / 迅速 / カットイン / 変装 / ヒラメキ / ミスリード / 捜査 / 痕跡 / ブレット 等を chip 表示
- カード data 上の `keywords` プロパティを使用 (CARD_POOL の各エントリに追加)

## 共通仕様

### MetaCard サイズ階層
- DECK 中央プール: `T.card.scene` (60×84)
- DECK 右リスト: `T.card.hand` (64×90)
- CARDS グリッド: 中サイズ (100×140 程度、SVG で `T.card.detail` ベースから縮小)
- CARDS 詳細パネル: `T.card.detail` (250×350)

### パフォーマンス
- DECK のカードプールは `useWindowedCollection` で初期 48 枚、スクロール中も最大 96 枚だけを描画する
- スペーサーはスクロール面、カードの gap は内側グリッドで管理し、選択・フォーカス中のカードは描画を維持する
- 40 枚の `DeckGrid` は window 化しない。各 card に `key={card.num}` 必須

### 色制限の表示
- DECK 編集でカードプールフィルターに「事件の色」設定があれば、その色以外を `dimmed` 表示
- 詳細: `rules/20-color-and-switch.md` (手札使用 / ネクストヒントは色制限)
- ただしカットイン / ヒラメキ / 効果による登場は色制限なし — UI 上は注釈表示のみ

## 関連
- 前: [06-screens-play-flow.md](06-screens-play-flow.md)
- 次: [08-screens-reference.md](08-screens-reference.md)
- 原典: `design-mockups_v2/06-deck-3col.jsx` + `06-deck-md.jsx` + `08-cards.jsx`
