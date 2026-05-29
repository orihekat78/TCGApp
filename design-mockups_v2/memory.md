# memory.md — コナン TCG デザインモック プロジェクト履歴

design-mockups/ ディレクトリで進めた全工程の要約。新規セッションで参照可能な状態にする。

---

## 成果物一覧

### HTML プロトタイプ
| ファイル | 内容 |
|---|---|
| **`05-effect-animations.html`** | 演出 6 種 × 2 案ずつの検証ボード(Hirameki / Contact / Solution / Misread / Card / Victory) |
| **`06-meta-screens.html`** | Master Duel 風ホーム + デッキ編集 2 案(3カラム / MDスプレッド)を DesignCanvas に配置 |
| **`07-screen-flow.html`** | 11 画面の遷移マップ(視覚図) |
| **`08-meta-screens-2.html`** | SETUP / RESULT / CARDS / HISTORY / TUTORIAL / SETTINGS の 6 画面 |
| **`09-prototype.html`** | クリッカブル動作プロトタイプ(URL ハッシュ + キーボード + フェード遷移 + engine stub) |
| **`match-board.html`** | `conan/design-mockups/01-board-mockup.html` のコピー — MATCH 画面 iframe ソース |

### 共通ライブラリ
| ファイル | 役割 |
|---|---|
| `animations.jsx` | Stage / Sprite / Easing 等のアニメーション基盤 |
| `06-card-data.jsx` | カードプール 47 枚 + SAMPLE_DECK(40 枚 ID制限準拠) |
| `06-shared.jsx` | T(トークン) / MetaBg / AppTopBar / MetaCard / SmallButton / SetupButton / SetupReadyButton / FilterGroup / EmptyState / WarningBanner / LoadingDots / NetworkStatus / CardSilhouette(漢字頭文字+役職アイコン+ID シードパターン) |
| `10-engine-stub.jsx` | localStorage-backed engine stub(cards.validateDeck / decks / history / flow.simulateMatch / settings / progress) |

### 画面コンポーネント
| ファイル | 画面 |
|---|---|
| `06-home.jsx` | ホーム(ニュース / 戦績 / マイデッキ / ストーリー進捗 / CTA) |
| `06-deck-3col.jsx` | デッキ編集 3カラム |
| `06-deck-md.jsx` | デッキ編集 Master Duel 風スプレッド |
| `08-setup.jsx` | 対戦準備(単独捜査 / 観察ルーム) |
| `08-result.jsx` | 対戦結果(真相解明 / 迷宮入り) |
| `08-cards.jsx` | カードリスト(コレクション) |
| `08-history.jsx` | 対戦履歴 |
| `08-tutorial.jsx` | チュートリアル |
| `08-settings.jsx` | 設定 |
| `09-placeholders.jsx` | MATCH iframe / REPLAY 仮画面 |
| `09-app.jsx` | プロトタイプルーター + HUD + ショートカット + キーボードヘルプ |

### ドキュメント
| ファイル | 内容 |
|---|---|
| `C-engine-ui-map.md` | 10 画面 × 12 engine namespace の対応マトリックス + モーダル 16 種対応 |
| `C9-modal-review.md` | モーダル 15 種を 4 カテゴリに整理 + 不足モーダル 5 種の提案 |
| `E13-design-system.md` | カラートークン / タイポ / コアコンポーネント / インタラクション CSS |
| `E14-screen-flow-spec.md` | 10 画面の遷移エッジ + props + キーボードショートカット + URL ハッシュ |
| `E15-component-guide.md` | 推奨ディレクトリ構成 + 状態管理パターン + a11y / パフォーマンス目標 + 移行スケジュール案(16-22 日) |
| `memory.md` | 本ファイル |

---

## 完了フェーズ

### Phase 1: 05 演出アニメ集
- 6 演出 × 2 案 = 12 シーンを `<Stage>` + `<Sprite>` 構造で実装
- 検証ボード(`05-effect-animations.html`)で並列再生・タイムラインスクラブ可

### Phase 2: メタゲーム画面群
- **06** ホーム + デッキ編集 2 案 → Tokyo-noir 統一テーマ
- **07** 11 画面遷移マップ(視覚図)
- **08** SETUP / RESULT / CARDS / HISTORY / TUTORIAL / SETTINGS の 6 画面
- **09** クリッカブル統合プロトタイプ(ハッシュルーティング + HUD + キーボード)

### Phase 3: 精査(A)
- A-1 シーン別背景装飾(9 画面に固有オーバーレイ)
- A-2 既存盤面との整合性監査(T に欠落 9 トークン追加 / AP 色統一)
- A-3 ホバー/フォーカス状態(8 種の meta-* CSS + a11y outline)
- A-4 空状態 / エラー状態(4 種コンポーネント + デッキ検証バナー)

### Phase 4: 内容精査(B)
- B-5 カード効果テキストの公式準拠化(代表 4 枚)
- B-6 チュートリアル本文 + 用語集の正確化
- B-7 デッキ構築ルール反映(40 枚 / 同 ID 3 枚上限)

### Phase 5: ドキュメント化(C / E)
- C-8 engine API 接続マップ
- C-9 モーダル 15 種レビュー
- E-13 デザインシステム書
- E-14 画面遷移仕様書
- E-15 コンポーネント実装ガイド

### Phase 6: プロトタイプ完成度(D)
- D-10 画面遷移アニメ(280ms フェード + 浮上)
- D-11 カード SVG 刷新(漢字頭文字 + 役職アイコン + ID シードパターン)
- D-12 キーボードショートカット + ヘルプオーバーレイ

### Phase 7: エンジン接続実装
- **10-engine-stub.jsx** 作成 — localStorage-backed
- ルーターに遷移フック追加:
  - SETUP→MATCH で `simulateMatch` 実行 → `window.__currentMatch`
  - MATCH→RESULT で `history.record` 実行
- **HISTORY** が `engineStub.history.list()` 優先表示
- **RESULT** が `window.__currentMatch` の実データ表示(MVP / ターン / コンタクト / ヒラメキ / 証拠)
- **DECK 検証バナー** が `engineStub.cards.validateDeck()` 実結果表示
- **ホームのマイデッキ** が `engineStub.decks.list()` + `engineStub.history.winRate()` 集計

---

## 命名規則 / 用語整理

| 旧 | 新 |
|---|---|
| 人間 vs CPU | **単独捜査(SOLO INVESTIGATION)** |
| CPU vs CPU | **観察ルーム(OBSERVE MODE)** |
| HUMAN / CPU バッジ | **DETECTIVE / AI** |
| ホームのアバター | **YOU / AI** |
| 履歴モードチップ | **SOLO / OBSERVE** |
| 通貨表示(GEM / COIN / ENERGY) | **削除**(F2Pスキャフォールド) |
| シーズン / ミッション / ログボ | **削除** |
| ナビ(SHOP / EVENTS) | **削除** |

新ナビ: HOME / DECK / CARDS / TUTORIAL / SETTINGS

---

## トークン参照

`conan/src/ui/styles/tokens.css` と `06-shared.jsx` の `T` オブジェクトが SoT。
主要色: `#0a1a28`(bg-deep) / `#ffd700`(accent-gold) / `#4ec3ff`(neon-blue)。
カード 5 色: 青 `#2b6cb5` / 黄 `#d4a425` / 赤 `#c84040` / 緑 `#3aa67a` / 紫 `#8a4cc0`。
カード内 stat: AP `#ff9b6e`(暖) / LP `#ffd75e`(金) / Lv `#6ed1ff`(冷)。

フォント: Hiragino Sans / Cascadia Code / Hiragino Mincho ProN。

---

## 残作業候補

- **CARDS 画面の採用デッキ集計**(現在は固定値 3/4)
- **対戦中の simulation 演出**(SETUP→MATCH 直後のローディング表示)
- **追加モーダル**(ガード宣言 / ネクストヒント / 敗北 / 名乗り解除 / 観戦)
- **CPU vs CPU 観戦モード強化**
- **画面 Tweaks**(密度 / テーマ切替の動的化)
- **本実装移行**(`conan/src/ui/meta/` 配下に TypeScript で起こす — Phase 9-A〜9-F)

### F 監査 残課題(中優先度)
- **チュートリアル章 04 を追加** — 解決編移行 + アシスト勝利不可ルール(`rules/01-victory-conditions.md` ⚠ 注意点)を扱う章。`08-tutorial.jsx` の章リスト 04 は現在 locked のため未実装
- **ヒラメキ図解の一般化** — `ChapterIllustration` の「キャラ1枚をアクティブにする」は萩原千速固有効果。「カード固有の効果が発動する」と一般化、特定例は別表記
- **"事件カード" vs "FILE エリア" の用語注釈** — 混同しないよう Tutorial / Placeholders に注釈追加

### F 監査 完了済
- ✅ `simulateMatch` の必要証拠数: 先攻 7 / 後攻 6 に修正
- ✅ ResultStats: p1Target/p2Target 表示
- ✅ HistoryList のマッピング修正
- ✅ DeckValidationBanner の「事件レベル 4」表記削除

---

## キーボードショートカット

| キー | 動作 |
|---|---|
| H / D / C / T / S | HOME / DECK / CARDS / TUTORIAL / SETTINGS |
| P / M / R / Y / L | SETUP / MATCH / RESULT / HISTORY / REPLAY |
| Enter(HOME 時) | 推理開始 → SETUP |
| Esc / Backspace | 戻る |
| ? | ヘルプ overlay |

---

## 起動確認

```
design-mockups/09-prototype.html
```

を開けば全機能を統合した状態でアクセス可能。

ハッシュ直アクセス:
- `#home` `#setup` `#match` `#result` `#deck` `#cards` `#history` `#replay` `#tutorial` `#settings`

localStorage キー(`10-engine-stub.jsx`):
- `conan.proto.decks` / `conan.proto.history` / `conan.proto.settings` / `conan.proto.progress`
