---
date: 2026-05-28
title: Phase 14 — MetaCard chrome 削除 + 未実装機能の完成 (カスタムデッキ実機対戦 / フィルター拡張 / log 集計 / 練習試合 / cardBack)
type: feat
scope: meta-app
---

## ユーザー指示

> カードごとに使われている青枠みたいなのは、対戦以外には必要ないので削除して外してください。
> また、モックの反映は出来たと思うので未実装のところについても実装を行ってください。

Phase 13 で全 9 画面の構造は揃ったが、MetaCard chrome (色枠/上部ストライプ/下部フッタ) が CardArt 公式画像と重なって冗長、また持ち越し項目が残っていた。Phase 14 でまとめて解消。

## 主要変更 (`meta-app/` のみ)

### MetaCard chrome 削除 (前段)
- `shared/MetaCard.tsx`: `linear-gradient` 背景 / 上部 cost+rarity ストライプ / 下部 name+AP フッタ / 色付き 1px border を**削除**
- 残置: 選択リング (gold outline) / count badge / favorited ★ / partner/case badge / hover アニメ
- 結果: 対戦外画面で `<CardArt cardId>` のみが素表示され、Playmat (src/) のカード描画と整合

### Phase 14-A: カスタムデッキ → engine DeckSpec 変換
- `util/customGameStart.ts` 新規: `toEngineDeck(deck: DeckRecord)` + `customGameStart(self, opp)` で src/gameStarter の内部ロジックをミラー
- `util/deckBridge.ts` の `isPlayable`: deckId 一致 → **validateDeck 合格** で判定に変更
- `screens/SetupScreen.tsx` の `handleReady`: `performGameStart` → `customGameStart(selfDeck, oppDeck)` に切替
- パートナー→事件マップ: `D08001/D08002 → D08026`, `D11001/D11002 → D11021`, color fallback で他にも対応
- 結果: カスタムデッキで実機対戦が動作するようになった

### Phase 14-B: DeckEditor フィルター拡張
- 既存の色/種別フィルターに加え:
  - `costFilter: Set<number>` (0〜8, 8 は 8+ 集約)
  - `featureFilter: Set<string>` (CARD_POOL 全 features 自動列挙)
  - `keywordFilter: Set<string>` (CARD_POOL 全 keywords 自動列挙)
- `FilterRail` UI に 3 つのフィルター + 全リセットで全クリア
- 全フィルター AND で適用、各 chip に件数表示

### Phase 14-C: HistoryScreen 統計を engine.log 集計へ
- `ResultScreen.buildMatchRecord` に `countLogActions(gs.log)` 追加
  - `contacts`: `contact-judge` / `contact:judge` カウント
  - `hirameki`: action / result に `hirameki` 含むエントリ
  - `misread`: action / result に `misread` 含むエントリ
- 新規対戦の MatchRecord は実値、旧履歴は 0 のまま (互換)

### Phase 14-D: TutorialScreen 練習試合 → 実ゲーム起動
- `startPractice()` 関数: SAMPLE_DECK (D08) + SAMPLE_DECK_OPP (D11) で `customGameStart` を直接呼出
- 章 04「練習試合」ボタンと SubToolbar「PRACTICE」ボタン両方が同じ動作
- SETUP 経由せず直接 #match へ遷移 → mulligan modal → 対戦開始

### Phase 14-E: SettingsScreen card back + audio 実装
- `metaStore.Settings` 拡張: `cardBack: CardBackId` ('gold'|'azure'|'crimson'|'jade'|'noir') + `bgmVolume` + `seEnabled`
- `onRehydrateStorage` で旧 v1 hydrate fallback (フィールド欠落 → default 補填)
- `CardBackSelector` コンポーネント: 5 種 gradient プレビュー + active バッジ + クリックで切替
- SystemRightRail に「CARD BACK · 現在」プレビュー追加
- audio スライダー / トグル は persist のみ (実音は Phase 15+)

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし
- ✅ Phase 11 統合経路保持
- ✅ 既存 vitest / playwright e2e 全件無修正で緑

## 検証

- tsc + build green
- meta-app e2e 19/19 全緑 (smoke 10 / golden-path 3 / cards 4 / engine-stub 2)
- 5174 で:
  - HOME/DECK/CARDS のカードが純粋な CardArt 表示 (chrome なし)
  - DeckEditor のフィルターが cost / 特徴 / キーワード も動作
  - SETUP → READY でカスタムデッキも実機対戦可能 (validateDeck OK 前提)
  - TUTORIAL の「練習試合」ボタンで直接実機対戦開始
  - SETTINGS で cardBack 選択 → persist → 再起動後も保持
  - RESULT 後 history に記録される MatchRecord に実 contacts/hirameki/misread

## 仕様 / 記録

- `.claude/specs/meta-ui/13-implementations.md` 新規 (83 行) + INDEX 登録
- `.claude/specs/INDEX.md` に Phase 14 追記

## 持ち越し (Phase 15+)

- ReplayScreen の実盤面再生 (`engine.event.applyUntil`)
- OpponentHeatmap を実 history から動的集計
- audio (BGM/SE) の実音実装
- TutorialScreen 進捗 persist
- バンドル分割 (chunk size warning 解消)
