# 11 — Phase 12 CardsScreen 元モック忠実再構築

## 背景

Phase 10 の `CardsScreen.tsx` (198 行) は元モック `design-mockups_v2/08-cards.jsx` (479 行) より大幅に簡素化されていた。スクショで COVERAGE パネル / 47/47 種類 / 検索 / 表示モード / ソート / ★ お気に入り / USAGE 統計 の欠落が指摘されたため、Phase 12 で元モックに忠実に作り直す。

カード**画像**は Phase 11-B で導入した `CardArt` (5173 CDN 公式画像) を維持。問題はレイアウト/機能のみ。

## 不変条件 (継続)

1. `src/` 配下 1 行も変更しない (import / JSON 読み込みのみ)
2. `localhost:5173` の既存ゲーム挙動完全維持
3. 既存 vitest / playwright e2e 全件無修正で緑

## カード総数: 47 枚 (JSON 直読)

```ts
// meta-app/src/data/cardPool.ts
import ctD08Raw from '../../../ct-d08-cards.json';  // 26 枚
import ctD11Raw from '../../../ct-d11-cards.json';  // 21 枚
export const CARD_POOL = [...D08, ...D11];          // 計 47 枚
```

JSON → CardDef マッピング:
- 日本語 type/color を英語 enum に変換 (`パートナー` → `partner`, `青` → `blue` 等)
- string の cost/ap/lp を `parseInt` で数値化
- effect → effectShort
- cutIn/hirameki/henso の有無 + effect 内テキストから keywords 派生

## 状態追加 (metaStore)

```ts
interface Settings {
  ...
  favorites: string[];  // cardNum array
}
toggleFavorite(cardNum), isFavorited(cardNum)
```

`conan.meta.v1.settings` 内に persist。`onRehydrateStorage` で旧 v1 (favorites 欠落) を `[]` fallback。

## MetaCard 拡張

`isFavorited?: boolean` prop を追加 → true で右上に ★ overlay (count badge と非衝突する位置)。

## CardsScreen レイアウト

3 ペイン grid (260px / flex / 360px) + 上部 SubToolbar:

| 領域 | 構成 |
|---|---|
| 上部 SubToolbar | COLLECTION 証拠ファイル + 47/47 + 検索ボックス + 表示モード + 新着順/コスト順 |
| 左 CoveragePanel | 100% + 47/47 種類 + BY COLOR バー × 5 色 + BY RARITY × D/C/R/SR |
| 左 FiltersPanel | 色 / 種別 / キーワード のチップ群 (件数表示) + リセット/結果ボタン |
| 中央 CardGrid | CARDS · N 件 一致 + ★お気に入り数 + grid (MetaCard + ★ overlay + count badge) |
| 右 SelectedDetail | カード大 + 番号/レアリティ/採用 + 名前 + 種別/特徴 + C/AP/LP 3 box + EFFECT + USAGE + ★お気に入り/+デッキへ追加 |

## USAGE 集計ロジック

- 採用デッキ: `decks.filter(d => d.cards.some(e => e.num === cardNum)).length`
- 勝率(採用時): 当該カードを含むデッキの試合のみで `wins/total`
- MVP 数: `history.filter(m => m.mvp === cardNum).length`

zustand selector で配列を取得 → render 内で `useMemo` 派生 (infinite loop 回避)。

## 検証

- tsc + build green (bundle 589KB)
- e2e 19 件全緑 (Phase 11 既存 15 件 + Phase 12 cards.spec.ts 4 件)
- 5174/#cards で COVERAGE / 47 件 / 検索 / ★ persist / + デッキへ追加 動作確認

## 関連
- 前: [10-integration-with-src.md](10-integration-with-src.md)
- 原典: `design-mockups_v2/08-cards.jsx` (479 行)
- 実装: `meta-app/src/{screens/CardsScreen,data/cardPool,state/metaStore,shared/MetaCard}.tsx`
- 同 spec INDEX: [INDEX.md](INDEX.md)
