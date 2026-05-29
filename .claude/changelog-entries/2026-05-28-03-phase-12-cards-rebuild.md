---
date: 2026-05-28
title: Phase 12 — CardsScreen を元モック忠実に再構築 + 47 枚カード対応
type: feat
scope: meta-app
---

## ユーザー指摘

> design-mockups_v2 既存のこちらでは、スクショのようになっていたのですがなぜ変更されているのでしょうか？

スクショで提示された元モック CARDS 画面 (COVERAGE パネル / 47/47 種類 / 検索 / ソート / ★ お気に入り / USAGE 統計) と私の Phase 10 実装の乖離 (約 42% 削減) が指摘された。Phase 11-B で導入した `CardArt` (公式画像) は維持しつつ、CardsScreen のレイアウト/機能のみ元モック `design-mockups_v2/08-cards.jsx` (479 行) に忠実に作り直した。

## 主要変更 (`meta-app/` のみ)

- **data/cardPool.ts 全面書換**: 27 枚ハードコード → `src/ct-d08-cards.json` (26 枚) + `src/ct-d11-cards.json` (21 枚) を直接 import + 型変換 (日本語 type/color → 英語 enum、string ap/lp/cost → number、cutIn/hirameki/henso + effect 文字列から keywords 派生)
- **state/metaStore.ts**: `favorites: string[]` フィールド追加、`toggleFavorite` / `isFavorited` action、`onRehydrateStorage` で旧 v1 (favorites 欠落) を `[]` fallback
- **shared/MetaCard.tsx**: `isFavorited?: boolean` prop 追加 → 右上に ★ overlay (count badge と非衝突位置)
- **screens/CardsScreen.tsx 全面書換** (198→528 行): SubToolbar (証拠ファイル + 47/47 + 検索 + 表示モード ✱✱✱ + 新着順/コスト順) + 左 CoveragePanel (100% + 47/47 + BY COLOR バー × 5 + BY RARITY × 4) + 左 FiltersPanel (色/種別/キーワード チップ群 + リセット) + 中央 CardGrid (CARDS · N 件 + ★お気に入り数 + auto-fill grid) + 右 SelectedDetail (大カード + C/AP/LP 3box + EFFECT セクション + USAGE: 採用デッキ N/D / 勝率 / MVP 数 + ★お気に入り toggle + + デッキへ追加)
- **tests/e2e/cards.spec.ts (新)**: 47/47 表示 / COVERAGE / 検索件数変化 / ★ お気に入り persist / + デッキへ追加 遷移
- **.claude/specs/meta-ui/11-cards-rebuild.md (新)** + INDEX 登録

## USAGE 集計ロジック

- 採用デッキ: `decks.filter(d => d.cards.some(e => e.num === cardNum)).length`
- 勝率(採用時): 当該カード採用デッキの試合のみで `wins/total`
- MVP 数: `history.filter(m => m.mvp === cardNum).length`

`useMemo` で派生計算 (zustand selector の infinite loop 回避)。

## 不変条件 (継続遵守)

- `src/` 配下 1 行も変更しない (JSON は import 経由)
- 既存 5173 ゲーム挙動完全維持、既存 vitest + playwright e2e 全件無修正で緑

## 検証

- tsc + build green (bundle 589KB)
- meta-app e2e 19/19 全緑 (Phase 11 既存 15 件 + Phase 12 cards.spec.ts 4 件)
- 5174/#cards: COVERAGE 100% (47/47) + BY COLOR/RARITY バー + 検索で件数変化 + 詳細パネル EFFECT/USAGE + ★ お気に入り → localStorage persist + + デッキへ追加で #deck 遷移、すべて動作

## 持ち越し (Phase 13+)

- 他画面 (HOME / DECK / HISTORY / TUTORIAL / SETTINGS) も元モック比 30-50% 簡素化されている。CardsScreen と同様 rebuild の余地あり (調査結果より)
- カスタムデッキ → engine DeckSpec 変換 (現状 D08 / D11 専用)
