# 12 — Phase 13 残り 7 画面の元モック忠実 rebuild

## 背景

Phase 12 で CardsScreen を元モック忠実版に書き直した実績を、ユーザー指示「他モックについても同様にお願いします」で残り 7 画面に横展開。

| 画面 | 元モック (LOC) | Phase 10 (LOC) | Phase 13 後 |
|---|---|---|---|
| ResultScreen   | 340 | 208 | 全面 rebuild (Backdrop / Verdict / MVPShowcase / ResultStats / Actions) |
| SetupScreen    | 343 | 242 | rebuild (ModeTile / PlayerConfigPanel / ConfigRow / SwapButton / OptionToggle) |
| HomeScreen     | 710 | 268 | rebuild (HeroBackdrop skyline / CenterHero / HeroPartner 3 カード stack / DuelButton / CampaignPanel) |
| DeckEditor     | 733 | 237 | rebuild (FilterRail / CardListGrid + CardDetailPanel / DeckHeader / DeckStats / CostCurve / ColorBar / DeckList) |
| HistoryScreen  | 442 | 157 | rebuild (HistorySubToolbar / WinRateSummary + sparkline / DeckPerformance / OpponentHeatmap) |
| TutorialScreen | 436 | 224 | rebuild (TutorialSubToolbar + 進捗 bar / ChapterProgress (rank) / ChapterList 状態別 / ChapterIllustration / CardDiagram / TermRow) |
| SettingsScreen | 360 | 173 | rebuild (CategoryRail 6 cats / SegmentedControl / Toggle / Slider / SystemRightRail) |
| ReplayScreen   | 118 | 125 | rebuild (BoardZone snapshot / Scrubber UI + 4 controls / ActionLog) |

## 不変条件 (継続)

1. `src/` 配下 1 行も変更しない
2. **Phase 11-C SetupScreen 配線保持**: `nav('match')` 先実行 → `performGameStart` async → `setGameState` の流れ
3. **Phase 11-E ResultScreen 配線保持**: `gameState` 直読 + `recordedRef` dedup + `setState({ gameState: null })` クリア
4. 既存 e2e 全件無修正で緑 (golden-path のテキスト名は新 UI に追従)

## 画面別変更ポイント

### ResultScreen (13-A)
- `ResultBackdrop` (radial bloom + light rays SVG + 40 particle dots)
- `ResultVerdict` (CASE SOLVED · VERDICT + 巨大 JP テキスト + VICTORY/DEFEAT)
- `MVPShowcase` (gradient 区切り + ⭐ MVP badge + big card + ContribRow x 4)
- `ResultStats` (MATCH SUMMARY + ScoreSide 勝敗 + 6 StatCompare グリッド + PROGRESS lines)
- `ResultActions` (5 ボタン: replay/review/rematch/next/home)
- Phase 11-E ロジックは `useEffect` + `useGameStateStore.setState({ gameState: null })` 経路をそのまま維持

### SetupScreen (13-B)
- `ModeTile` (SELECTED badge + sub/title/tag + ModeAvatar 2 + desc)
- `PlayerConfigPanel` (P1/P2 + partner MetaCard + ConfigRow 3-4 + MiniMetric 3)
- `SwapButton` (SVG icon + SWAP label)
- `SetupMatchOptions` (4 OptionToggle: 先攻/演出速度/自動進行/効果ログ)
- Phase 11-C `handleReady` ロジックは完全不変

### HomeScreen (13-C)
- `HeroBackdrop` (skyline SVG + giant magnifier watermark + light beam)
- `CenterHero` (CASE FILE banner + 巨大タイトル + `HeroPartner` 3 カード fan + `DuelButton`)
- `HeroPartner` (partner + 2 supporting MetaCard with rotate + sparkle particles)
- `DuelButton` (大型シェブロン形 推理開始)
- 左 News/Recent + 右 MyDecks/Campaign + 下部 5 CTA tiles 強化
- partner / supporting カード画像は `CardArt` (Phase 11-B) で実画像

### DeckEditor (13-D)
- `SubToolbar` (デッキ名入力 + デッキ切替 select + キャンセル/保存 ボタン)
- `FilterRail` (色/種別 chip + リセット)
- `CardListGrid` (47 枚 grid + 選択 highlight + ＋ 追加 ボタン)
- `CardDetailPanel` (大カード + 番号/色/レアリティ Pill + StatBox C/AP/LP + EFFECT + キーワード)
- `DeckHeader` (パートナー MetaCard + 名前 + 枚数 box 40/40)
- `DeckStats` (COST CURVE bar chart + COLOR breakdown + TYPE rows)
- `DeckList` (sorted by cost, クリックで -1, AP 表示 + キーワード mini chip + count badge)
- `WarningBanner` で validateDeck 結果表示

### HistoryScreen (13-E)
- `HistorySubToolbar` (タイトル + 結果フィルタ chip + デッキ select + 件数)
- `WinRateSummary` (大%表示 + 勝/負/計 Trend + sparkline 14 戦)
- `DeckPerformance` (実 history からデッキ別勝率集計 + bar)
- `HistoryList` (W/L badge + デッキ名 + 詳細統計 + 日時)
- `MatchDetail` (右パネル + 9 詳細行 + REPLAY ボタン)
- `OpponentHeatmap` (3x5 マッチアップ matrix、静的サンプル)

### TutorialScreen (13-F)
- `SubToolbar` (進捗 bar + 練習試合 button)
- `ChapterProgress` (rank 名 + 次階級まで step 数)
- `ChapterList` (locked/cleared/current 状態別 styling、🔒/✓/N アイコン)
- `ChapterContent` (章 header + TutorialStep grid + ナビゲーション)
- `ChapterIllustration` (CardDiagram 2 + 矢印 + WARNING bar + TermRow 4 + POINT box)
- 章 04 にアシスト勝利不可の図解を追加 (F-rule-audit 残課題対応)

### SettingsScreen (13-G)
- `Header` (戻る + データ削除 destructive ボタン)
- `CategoryRail` (6 カテゴリ: 対戦/画面/音声/操作/データ/このアプリ、icon + active state)
- `DetailPanel` (カテゴリ別: visual=テーマ/密度/演出速度、play=spectator AI、audio/control/data/about も簡易)
- `SegmentedControl` (option array で active 切替)
- `Toggle` (44x22 thumb + green glow when on)
- `Slider` (range input + 表示)
- `SystemRightRail` (version/port/decks/history/namespace/不変保証 6 行 + 注釈 box)

### ReplayScreen (13-H)
- match selector 後の盤面 snapshot 表示
- `BoardZone` (label + partner card mock + 現場カード mock 並び)
- Scrubber: ⏮ ◀ ▶ ⏭ ボタン 4 個 + Turn 表示 + progress bar
- `ActionLog` (turn ごとのカラーログ 4 行)
- 「実盤面再生は Phase 14+ 予定」注釈

## 検証

- tsc + build green
- e2e 19/19 全緑 (Phase 12 既存 + 既存テストの新テキスト追従 2 件修正)
- 既存 src/ git diff = 0 (Phase 10/11/12 から継続)

## 関連
- 前: [11-cards-rebuild.md](11-cards-rebuild.md) / 原典: `design-mockups_v2/{06-home, 06-deck-3col, 08-result, 08-setup, 08-history, 08-tutorial, 08-settings, 09-placeholders}.jsx`
- 実装: `meta-app/src/screens/*.tsx` 全 8 画面
