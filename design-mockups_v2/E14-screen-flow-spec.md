# E-14 — 画面遷移仕様書

`07-screen-flow.html` の図を Markdown 化。各画面のエントリーポイント・離脱条件・必要 props を一覧化する。

---

## 画面一覧と状態

| code | 画面 | 実装 | 1920×1080 想定 |
|---|---|---|---|
| `home` | ホーム | ✅ 設計済 (`06-home.jsx`) | はい |
| `setup` | 対戦準備 | ✅ 設計済 (`08-setup.jsx`) | はい |
| `match` | 対戦 | ✅ 実装済 (`match-board.html` iframe) | はい |
| `result` | 対戦結果 | ✅ 設計済 (`08-result.jsx`) | はい |
| `deck` | デッキ編集 | ✅ 設計済 (`06-deck-3col.jsx`) | はい |
| `cards` | カードリスト | ✅ 設計済 (`08-cards.jsx`) | はい |
| `history` | 対戦履歴 | ✅ 設計済 (`08-history.jsx`) | はい |
| `replay` | リプレイ詳細 | ✅ 設計済 (`09-placeholders.jsx`) | はい |
| `tutorial` | チュートリアル | ✅ 設計済 (`08-tutorial.jsx`) | はい |
| `settings` | 設定 | ✅ 設計済 (`08-settings.jsx`) | はい |

---

## 遷移エッジ(エッジ ID は HUD 内で `data-nav-to` 経由)

### PLAY FLOW(主要対戦経路)

| from | to | トリガー | 種別 |
|---|---|---|---|
| `home` | `setup` | 「推理開始」ボタン / Enter キー | primary |
| `setup` | `match` | READY(推理開始)ボタン | primary |
| `setup` | `home` | 戻るボタン / Esc | back |
| `match` | `result` | 勝敗確定 / 決着ボタン / 投了 | end |
| `match` | `setup` | セットアップへ戻る | back |
| `result` | `setup` | 「次の対戦」ボタン | continue |
| `result` | `match` | 「このデッキで再戦」 | rematch |
| `result` | `replay` | 「盤面を見直す」 | drill-in |
| `result` | `home` | 「ホームへ」 | return |

### LIBRARY(カード管理)

| from | to | トリガー |
|---|---|---|
| `home` | `deck` | 下部 CTA / D キー / DECK タブ |
| `home` | `cards` | 下部 CTA / C キー / CARDS タブ |
| `deck` | `cards` | カードプール展開(ADD) |
| `cards` | `deck` | 「+ デッキへ追加」 |
| `deck` | `match` | 「テスト対戦」(PLAYTEST) |
| `deck` | `home` | 「保存して戻る」 |

### REFERENCE(履歴・学習・設定)

| from | to | トリガー |
|---|---|---|
| `home` | `history` | 下部 CTA / Y キー |
| `history` | `replay` | 「詳細 ▸」ボタン |
| `replay` | `history` | 「履歴へ戻る」 |
| `home` | `tutorial` | 下部 CTA / T キー / TUTORIAL タブ |
| `tutorial` | `match` | 「練習試合(PRACTICE)」/「次へ」 |
| `home` | `settings` | 下部 CTA / S キー / SETTINGS タブ |

### グローバル

| from | to | トリガー |
|---|---|---|
| any | `home` | TopBar HOME タブ / H キー / HUD HOME ボタン |
| any | previous | HUD BACK ボタン / Esc |
| any | any | HUD JUMP メニュー |

---

## 各画面の必要 props と状態

### `home`
- props: なし
- 読み: `getCards()`, localStorage(decks, recent matches, campaign-progress)
- 副作用: なし

### `setup`
- props: `partnerL`, `partnerR`(初期値、optional)
- 読み: 保存済みデッキ
- 書き: 「対戦準備」状態を一時的に保持(localStorage には書かない)
- 出口: READY 押下時に `match` へ + 設定を渡す

### `match`
- props: `setup`(P1 デッキ / P2 デッキ / モード / 難易度)
- 読み/書き: engine state(`engine.read.*` / `engine.mutate.*`)
- 出口: `engine.read.gameResult ≠ 'ongoing'` で `result` へ自動遷移

### `result`
- props: `state`(終了時の engine state), `mode`('win' | 'lose')
- 読み: state からスタッツ計算
- 書き: 履歴に保存(localStorage `match-history`)、デッキ戦績更新
- 出口: いくつかの選択肢へ

### `deck`
- props: `deckId`(編集対象、optional — 新規なら空)
- 読み: CARD_POOL, 保存済みデッキ
- 書き: localStorage(`decks`)
- 検証: `engine.cards.validateDeck`

### `cards`
- props: `initialFilter`(optional)
- 読み: CARD_POOL, 採用率(localStorage の decks 走査)
- 書き: なし(お気に入りのみ localStorage)

### `history`
- props: `filter`(optional)
- 読み: localStorage(`match-history`)
- 書き: なし

### `replay`
- props: `matchId`(必須)
- 読み: 履歴エントリの replayLog
- 書き: なし
- エンジン: `engine.event.applyUntil(state, log, t)` で時点復元

### `tutorial`
- props: `chapter`(現在章 id、optional — デフォルト current)
- 読み: localStorage(`tutorial-progress`)
- 書き: ステップクリア時に更新
- 出口: 練習試合は `match` へ

### `settings`
- props: なし
- 読み/書き: localStorage(`settings`)

---

## キーボードショートカット表

| キー | 動作 |
|---|---|
| `H/D/C/T/S` | HOME/DECK/CARDS/TUTORIAL/SETTINGS |
| `P/M/R/Y/L` | SETUP/MATCH/RESULT/HISTORY/REPLAY |
| `Enter` | (HOME 時)推理開始 → SETUP |
| `Esc` / `Backspace` | 戻る |
| `?` | キーボードヘルプ表示 |

---

## トランジション

- 画面切替: 280ms フェードイン + 8px 上昇 + ブラー解除
- `cubic-bezier(.2,.7,.3,1)`
- `key={route}` で React の再マウントを利用

---

## URL ハッシュとブックマーク

- `#home`, `#setup`, `#match`, `#result`, `#deck`, `#cards`, `#history`, `#replay`, `#tutorial`, `#settings`
- ブラウザの戻る/進むボタンと同期
- リロードで状態保持(画面のみ。エンジン state は保持しない)

---

## 関連
- `design-mockups/07-screen-flow.html` — ビジュアル遷移図
- `design-mockups/09-app.jsx` — ルーター実装
- `design-mockups/C-engine-ui-map.md` — エンジン接続点
