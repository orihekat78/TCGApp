# コナン TCG メタゲーム デザインモック

`conan/` 本体(対戦エンジン + 盤面 UI)に対して、**メタゲーム部分**(ホーム / デッキ編集 / 対戦準備 / 結果 / 履歴 / カードリスト / チュートリアル / 設定)の高密度デザインモックとクリッカブルプロトタイプを格納するディレクトリ。

---

## クイックスタート

```bash
# ブラウザで直接開く
open design-mockups/09-prototype.html
```

または検証用の Design Canvas:
- `design-mockups/06-meta-screens.html` — ホーム + デッキ編集 2 案
- `design-mockups/08-meta-screens-2.html` — SETUP / RESULT / CARDS / HISTORY / TUTORIAL / SETTINGS
- `design-mockups/07-screen-flow.html` — 視覚的な遷移マップ
- `design-mockups/05-effect-animations.html` — 対戦中の演出 12 種

---

## ファイル構成

```
design-mockups/
├── README.md                     ← 本ファイル
├── memory.md                     ← 作業履歴・全体総括
│
├── 05-effect-animations.html     ← 対戦演出 6 種 × 2 案
├── 05-app.jsx                    ← 演出ボード App
├── 05-card.jsx                   ← 演出用カード描画プリミティブ
├── 05-fx.jsx                     ← 演出用エフェクト(光輪・パーティクル等)
├── 05-scenes-hirameki.jsx        ← ヒラメキ A/B
├── 05-scenes-contact.jsx         ← コンタクト VS A/B
├── 05-scenes-solution.jsx        ← 解決編突入 A/B
├── 05-scenes-misread.jsx         ← ミスリード A/B
├── 05-scenes-card.jsx            ← カード効果発動 A/B
├── 05-scenes-victory.jsx         ← 勝利/敗北 A/B
│
├── 06-meta-screens.html          ← ホーム + デッキ編集 Design Canvas
├── 06-card-data.jsx              ← CARD_POOL 47 枚 + SAMPLE_DECK
├── 06-shared.jsx                 ← トークン T + 共通コンポーネント群
├── 06-home.jsx                   ← Master Duel 風ホーム
├── 06-deck-3col.jsx              ← デッキ編集 3 カラム
├── 06-deck-md.jsx                ← デッキ編集 MD 風スプレッド
│
├── 07-screen-flow.html           ← 11 画面の遷移マップ(視覚図)
│
├── 08-meta-screens-2.html        ← 6 画面 Design Canvas
├── 08-setup.jsx                  ← 対戦準備(単独捜査/観察ルーム)
├── 08-result.jsx                 ← 対戦結果(真相解明/迷宮入り)
├── 08-cards.jsx                  ← カードリスト(コレクション)
├── 08-history.jsx                ← 対戦履歴 + 集計
├── 08-tutorial.jsx               ← チュートリアル
├── 08-settings.jsx               ← 設定
│
├── 09-prototype.html             ← クリッカブル統合プロトタイプ
├── 09-app.jsx                    ← ルーター + HUD + ショートカット
├── 09-placeholders.jsx           ← MATCH/REPLAY 仮画面
├── 10-engine-stub.jsx            ← localStorage-backed エンジンスタブ
│
├── match-board.html              ← 対戦盤面(01-board-mockup のコピー)
├── animations.jsx                ← Stage/Sprite/Easing 基盤
├── design-canvas.jsx             ← Design Canvas ラッパー
│
└── docs/
    ├── C-engine-ui-map.md        ← 画面 ↔ engine API 対応
    ├── C9-modal-review.md        ← モーダル 15 種レビュー
    ├── E13-design-system.md      ← デザインシステム書
    ├── E14-screen-flow-spec.md   ← 画面遷移仕様書
    └── E15-component-guide.md    ← コンポーネント実装ガイド
```

> ※ docs/ は概念上のグループ。実際は `design-mockups/` 直下に配置されています。

---

## 主要ファイルの説明

### 統合プロトタイプ
- **`09-prototype.html`** — すべての画面を統合した動作版。URL ハッシュでルーティング(`#home`/`#setup`/etc.)、キーボードショートカット、フェード遷移、engine stub による実データ動作。**最初に開くのはここ**。
- **`09-app.jsx`** — `PrototypeApp` ルーターコンポーネント。`useHashRoute` で画面切替、`[data-nav-to]` 属性のクリック委譲、キーボードハンドラ、左下フローティング HUD(BACK / 現画面 / JUMP / HOME / NetworkStatus)。

### 共通プリミティブ
- **`06-shared.jsx`** — 全画面で共有。`T`(設計トークン)・`MetaBg`(シーン別背景)・`AppTopBar`・`MetaCard`(漢字頭文字 + 役職アイコン + ID シードパターンの SVG)・`SmallButton`/`SetupButton`/`SetupReadyButton`・`FilterGroup`・`EmptyState`/`WarningBanner`/`LoadingDots`/`NetworkStatus`・インタラクション CSS(`meta-*` クラス)を提供。
- **`06-card-data.jsx`** — `window.CARD_POOL`(ct-d08 + ct-d11 由来 47 枚)+ `window.SAMPLE_DECK`(公式ルール準拠 40 枚)+ `getCards()` / `deckStats()` ヘルパー。
- **`10-engine-stub.jsx`** — エンジン代わりの localStorage バックエンド。`engineStub.cards.validateDeck()`(40枚・同ID3枚・パートナー不可検証)・`engineStub.decks`(永続化)・`engineStub.history.record()` & `winRate()` ・`engineStub.flow.simulateMatch()`(シード固定フェイク対戦)。

### 画面実装
それぞれ 1920×1080 を想定。`window.<ScreenName>` にエクスポートされる:

| ファイル | 公開コンポーネント |
|---|---|
| `06-home.jsx` | `HomeScreen` |
| `06-deck-3col.jsx` | `DeckEditor3Col` |
| `06-deck-md.jsx` | `DeckEditorMD` |
| `08-setup.jsx` | `SetupScreen` |
| `08-result.jsx` | `ResultScreen` |
| `08-cards.jsx` | `CardsScreen` |
| `08-history.jsx` | `HistoryScreen` |
| `08-tutorial.jsx` | `TutorialScreen` |
| `08-settings.jsx` | `SettingsScreen` |
| `09-placeholders.jsx` | `MatchPlaceholder`, `ReplayPlaceholder` |

### ドキュメント
- **`memory.md`** — 全工程の作業履歴と総括。新規セッション時はここから読むと早い。
- **`E13-design-system.md`** — `tokens.css` 逆輸入用のトークン定義集約。
- **`E14-screen-flow-spec.md`** — 画面ごとの props・状態・遷移エッジ。
- **`E15-component-guide.md`** — React 実装に落とす際の構造案・状態管理・移行スケジュール案。
- **`C-engine-ui-map.md`** — 各 UI 要素が呼ぶ engine 関数のマトリックス。
- **`C9-modal-review.md`** — 既存モーダル 15 種の分類 + 不足モーダル提案。

---

## 画面遷移フロー

`07-screen-flow.html` の視覚版に対応するテキスト表現:

```
                    ┌─────────────────────────────────────┐
                    │           HOME (ハブ)               │
                    │  ニュース / 戦績 / マイデッキ /     │
                    │  ストーリー進捗 / 5 つの CTA       │
                    └─────┬───┬───┬───┬───┬───────────────┘
        ┌─────────────────┘   │   │   │   └────────────────────┐
        │ 推理開始             │   │   │ 履歴                    │ 設定
        ▼ Enter               │   │   ▼ Y                       ▼ S
  ┌──────────┐                │   │  ┌──────────┐         ┌──────────┐
  │  SETUP   │ デッキ・難易度  │   │  │ HISTORY  │ 詳細→   │ SETTINGS │
  │ 単独捜査 │ READY           │   │  │ 128 戦   ├────────►│ 画面/音声│
  │ 観察ルーム│                │   │  │ 集計     │         │ /操作    │
  └─────┬────┘                │   │  └──────────┘         └──────────┘
        │ READY · BEGIN MATCH  │   │       │
        ▼ ─────────────────────┘   │       ▼
  ┌──────────┐                     │  ┌──────────┐
  │  MATCH   │ engine state         │  │  REPLAY  │
  │ (盤面)   │ (実装は conan/src/ui)│  │ タイムライン
  └─────┬────┘                     │  └─────┬────┘
        │ 勝敗確定                  │        │
        ▼                          │        ▼
  ┌──────────┐                     │   ┌──────────┐
  │  RESULT  │ MVP/統計            │   │ HISTORY  │ (戻る)
  │ 真相解明 ├─→ 次の対戦・ホーム  │   └──────────┘
  └──────────┘
        │ デッキ
        ▼ D
  ┌──────────┐         ┌──────────┐
  │   DECK   │ ⇄ ADD →│  CARDS   │
  │ 編集     │ ← VIEW │ コレクション
  └──────────┘         └──────────┘
        │ チュートリアル
        ▼ T
  ┌──────────┐
  │ TUTORIAL │ 練習試合 → MATCH
  │ 6 章     │
  └──────────┘
```

### 主要遷移エッジ

| from | to | トリガー |
|---|---|---|
| HOME | SETUP | 「推理開始」 / `Enter` |
| SETUP | MATCH | 「READY · BEGIN MATCH」 |
| MATCH | RESULT | 勝敗確定 / 投了 |
| RESULT | SETUP / MATCH / HOME / REPLAY | 各アクションボタン |
| HOME | DECK | 下部 CTA / `D` |
| DECK | CARDS | カード追加 |
| HOME | HISTORY | 下部 CTA / `Y` |
| HISTORY | REPLAY | 「詳細 ▸」 |
| any | HOME | TopBar / `H` / HUD |
| any | previous | HUD BACK / `Esc` |

---

## キーボードショートカット

| キー | 動作 |
|---|---|
| `H` / `D` / `C` / `T` / `S` | HOME / DECK / CARDS / TUTORIAL / SETTINGS |
| `P` / `M` / `R` / `Y` / `L` | SETUP / MATCH / RESULT / HISTORY / REPLAY |
| `Enter`(HOME 時) | 推理開始 → SETUP |
| `Esc` / `Backspace` | 戻る |
| `?` | キーボードヘルプ表示 |

---

## データフロー

```
   ユーザー操作                            localStorage
       │                                       │
       ▼                                       │
 ┌─────────────────┐                            │
 │  09-app.jsx     │  navigate('match')         │
 │  ルーター        │ ───────────┐               │
 └─────────────────┘            │               │
       │                        ▼               │
       │                ┌────────────────┐      │
       │                │ engineStub     │      │
       │                │ .flow          │ ◄────┤
       │                │ .simulateMatch │      │
       │                └───────┬────────┘      │
       │                        │               │
       │                        ▼               │
       │              window.__currentMatch     │
       │                        │               │
       │                        ▼               │
       │                 navigate('result')     │
       │                        │               │
       │                        ▼               │
       │              ┌──────────────────┐      │
       │              │ engineStub       │      │
       │              │ .history.record  │ ────►┤
       │              └──────────────────┘      │
       │                                        │
       └──→ HOME/HISTORY/DECK が                │
           localStorage を読み取って表示  ◄─────┘
```

---

## 著作権について

- 公式コナン画像はリポジトリに同梱不可(README in `conan/design-mockups/` 参照)
- カード画像は `CardSilhouette` で生成された **漢字頭文字 + 役職アイコン + ID シードパターン**で代替
- ルール記述は `conan/.claude/rules/` 由来。引用範囲内で公式準拠

---

## 関連リソース

- 本体実装: `conan/src/`(エンジン + 対戦 UI)
- ルール: `conan/.claude/rules/`(32 ファイル)
- 仕様: `conan/.claude/specs/`(UI / Engine API)
- 既存盤面モック: `conan/design-mockups/01-board-mockup.html`
- スタイルトークン正本: `conan/src/ui/styles/tokens.css`
