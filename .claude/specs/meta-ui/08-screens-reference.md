# 08 — 履歴・学習・設定 (HISTORY / REPLAY / TUTORIAL / SETTINGS)

## HistoryScreen

### Props / 状態
- props: `filter?: { deckName?: string; won?: boolean }` (optional, URL クエリ)
- 読み取り: `engineStub.history.list()`
- 書き出し: なし

### レイアウト (`design-mockups_v2/08-history.jsx` 準拠)
- 上部: TopBar + フィルター行 + 集計サマリ (総戦数 / 勝率 / 平均ターン)
- メイン左: マッチリスト (時系列降順, 1 行 = MatchRecord, MetaRow ホバー対応)
- メイン右: 選択マッチの詳細パネル (turns / contacts / hirameki / misread / evidence)
- ヒートマップ: デッキ別勝率 (デッキ vs 相手デッキ)

### 命名規則 (`design-mockups_v2/memory.md` 準拠)
- 履歴モードチップ: SOLO / OBSERVE (HUMAN/CPU ではない)

### CTA
- 「詳細 ▸」 → `#replay?id={matchId}`

---

## ReplayScreen

### Props / 状態
- props: `matchId: string` (必須、URL クエリ)
- 読み取り: `engineStub.history.byId(matchId)`
- 書き出し: なし

### 実装範囲
- Phase 10 ではプレースホルダー実装 (`design-mockups_v2/09-placeholders.jsx` の ReplayPlaceholder ベース)
- 実盤面再生 (`engine.event.applyUntil`) は Phase 11+ で検討
- 表示内容: 試合サマリ + ターン推移グラフ (静的) + 「履歴へ戻る」ボタン

---

## TutorialScreen

### Props / 状態
- props: `chapter?: number` (optional, 現在章, デフォルト 1)
- 読み取り: 静的章テキスト + `useMetaStore.settings._progress` (将来用)
- 書き出し: なし (進捗 persist は Phase 11)

### レイアウト (`design-mockups_v2/08-tutorial.jsx` 準拠)
- 左: 章リスト (1-6)
- 右: 章本文 + 図解 (`ChapterIllustration`)

### F-rule-audit 残課題反映 (10-H 必須)

| 修正内容 | 詳細 |
|---|---|
| **章 04 追加** | 解決編 + アシスト勝利不可 (`rules/01-victory-conditions.md` ⚠ アシストしたターンは事件解決不可) |
| **ヒラメキ図解一般化** | 「キャラ1枚をアクティブにする」(萩原千速固有) → 「カード固有の効果が発動する」 (一般化) + 特定例は別表記 |
| **用語注釈** | "事件カード" vs "FILE エリア" の混同回避注釈 |

### デモ起動内包 (KEY decision)
- 章 04 (解決編) 末尾に「ヒラメキ実機デモ」「カットイン実機デモ」ボタンを設置
- ボタン押下 → `engineStub.flow.simulateMatch` で特定シナリオを実行 → MATCH 画面で演出のみ流す
- これにより SetupScreen advanced section や `#debug` ルートを作らずに済む

### 章リスト
1. 基本ルール (デッキ構築 + 場のエリア)
2. ターン進行 (オート / メイン / エンド)
3. キャラ行動 (推理 / アクション / ガード)
4. **解決編 + アシスト勝利不可** (新規追加) + 実機デモ起動
5. 効果と能力 (カットイン / 変装 / ヒラメキ / ミスリード)
6. 上級者向け (MR / 痕跡 / 色制限 / スタン状態)

---

## SettingsScreen

### Props / 状態
- props: なし
- 読み取り/書き出し: `useMetaStore.settings`

### レイアウト (`design-mockups_v2/08-settings.jsx` 準拠)
- セクション 1: 画面 (theme: noir/crimson, density: compact/comfortable)
- セクション 2: 音声 (volume, BGM ON/OFF) — Phase 11+ で実装
- セクション 3: 操作 (speed, spectatorAi ms)
- セクション 4: システム (アプリ version, リセット, データ削除)

### システム情報表示
- アプリ version: `meta-app/package.json` から取得 (Vite `import.meta.env`)
- localStorage 使用量 (合計 KB / 上限 5MB)
- 「データ削除」: 確認モーダル → `localStorage.clear` で全 namespace 削除 + reload

### 永続化
- 各設定変更時に即 `setSettings()` 呼び出し (persist が自動で localStorage に書き出し)

## 共通仕様
- 全画面 `<AppTopBar route={route} />` + `<MetaBg scene={route}>`
- フォーカス可能要素は `:focus-visible` で金色 outline
- 各画面遷移時に `<AppTopBar>` のナビ active state を反映

## 関連
- 前: [07-screens-library.md](07-screens-library.md)
- 次: [09-phasing-and-verification.md](09-phasing-and-verification.md)
- 原典: `design-mockups_v2/08-history.jsx` + `09-placeholders.jsx` + `08-tutorial.jsx` + `08-settings.jsx`
