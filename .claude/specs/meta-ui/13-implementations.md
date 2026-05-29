# 13 — Phase 14: chrome 削除 + 未実装機能の完成

## 背景

ユーザー指示:
1. 「カードごとに使われている青枠みたいなのは、対戦以外には必要ないので削除して外してください」
2. 「未実装のところについても実装を行ってください」

Phase 10〜13 で構造は揃ったが、MetaCard の chrome がカード公式画像 (CardArt) と重なって冗長、また持ち越し項目が残っていた。Phase 14 でまとめて解消。

## 不変条件 (継続)

1. `src/` 配下 1 行も変更しない
2. Phase 11 統合経路保持 (`useGameStateStore`, `setGameState(null)` クリア、custom 経由の async)
3. 既存 e2e 全件無修正で緑

## A. MetaCard chrome 削除 (前段)

- 削除: `linear-gradient` 背景 / `color stripe top` (cost circle + rarity) / `name footer` (bottom gradient + AP) / 色付き 1px border
- 残置: 選択リング (gold outline) / count badge / favorited ★ / partner/case badge / hover アニメ
- 結果: `<CardArt cardId>` のみが素表示され、対戦画面 (Playmat) のカード描画と整合 (Playmat は src/CardArt をそのまま使う)

## B. Phase 14-A: カスタムデッキ → engine DeckSpec 変換

- `meta-app/src/util/customGameStart.ts` 新規
  - `toEngineDeck(deck: DeckRecord)`: `{ partnerId, caseId (パートナーから推定), mainCards (count 分展開) }` を生成
  - `customGameStart(self, opp): Promise<GameState>`: src/gameStarter の内部ロジックをミラー (init → decideFirstPlayer → dealOpeningHand × 2 → mulligan loop → reveal → startGame → startTurn → resolve)
- `deckBridge.isPlayable`: deckId 一致ではなく **`validateDeck` 合格** で playable 判定
- `SetupScreen.handleReady`: `performGameStart` → `customGameStart(selfDeck, oppDeck)` に切替 → カスタムデッキでも実機対戦が可能に
- パートナー→事件マップ: `D08001/D08002 → D08026`、`D11001/D11002 → D11021`、それ以外は color で fallback

## C. Phase 14-B: DeckEditor フィルター拡張

- `colorFilter` / `typeFilter` (既存) に加え:
  - `costFilter: Set<number>` (0〜8, 8 は 8+ で集約)
  - `featureFilter: Set<string>` (CARD_POOL 全 features 自動列挙)
  - `keywordFilter: Set<string>` (CARD_POOL 全 keywords 自動列挙)
- `FilterRail` UI に 3 つのフィルター追加 + リセットで全クリア
- 全フィルター AND で適用、各 chip に件数表示

## D. Phase 14-C: HistoryScreen 統計を engine.log 集計へ

- `ResultScreen.buildMatchRecord` に `countLogActions(gs.log)` を追加
  - `contacts`: action `contact-judge` / `contact:judge` カウント
  - `hirameki`: action / result に `hirameki` 含むエントリ
  - `misread`: action / result に `misread` 含むエントリ
- 新規対戦の MatchRecord は実値、旧履歴は 0 のまま (互換)
- HistoryScreen の DeckPerformance や MatchDetail で自動的に反映

## E. Phase 14-D: TutorialScreen 練習試合 → 実ゲーム起動

- `startPractice()` 関数追加: SAMPLE_DECK (D08) + SAMPLE_DECK_OPP (D11) で `customGameStart` を直接呼出
- 章 04 の「練習試合」ボタンと SubToolbar の「PRACTICE」ボタン両方が同じ動作
- SETUP 画面を経由せず直接 #match へ遷移 → mulligan modal → 対戦開始

## F. Phase 14-E: SettingsScreen card back + audio 実装

- `metaStore.Settings` に追加:
  - `cardBack: CardBackId` ('gold' | 'azure' | 'crimson' | 'jade' | 'noir')
  - `bgmVolume: number` (0〜100)
  - `seEnabled: boolean`
- `onRehydrateStorage` で旧 v1 hydrate fallback (フィールド欠落 → default 補填)
- `CardBackSelector` コンポーネント: 5 種の gradient プレビュー + active バッジ + クリックで切替
- SystemRightRail に「CARD BACK · 現在」プレビュー追加
- audio スライダー / トグルは persist のみ (実音は Phase 15+)

## 検証

- tsc + build green
- e2e 19/19 全緑 (回帰なし)
- 既存 `src/` git diff = 0 (Phase 10/11/12/13 から継続)
- 5174 で:
  - HOME/DECK/CARDS のカードが純粋な CardArt 表示 (chrome なし)
  - DeckEditor のフィルターが cost / 特徴 / キーワード も動作
  - SETUP → READY でカスタムデッキも実機対戦可能 (validateDeck OK 前提)
  - TUTORIAL の「練習試合」ボタンで直接実機対戦開始
  - SETTINGS で cardBack 選択 → persist → 再起動後も保持
  - RESULT 後 history に記録される MatchRecord に実 contacts/hirameki/misread

## 関連

- 前: [12-screens-rebuild.md](12-screens-rebuild.md)
- 実装: `meta-app/src/{shared/MetaCard,util/customGameStart,util/deckBridge,state/metaStore,screens/{SetupScreen,DeckEditor,ResultScreen,TutorialScreen,SettingsScreen}}.tsx`
