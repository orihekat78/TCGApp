# E-13 — デザインシステム

メタゲーム画面(06-shared.jsx 起点)で使用しているトークン・コンポーネント・パターンを 1 ファイルにまとめる。`conan/src/ui/styles/tokens.css` に逆輸入可能な構造で整理。

---

## カラートークン

### Base palette(盤面背景)
```
--bg-deep      #0a1a28   最暗ネイビー
--bg-zone      #1b3a5c   ゾーン基調
--bg-self-1    #0d2640   自陣グラデ上
--bg-self-2    #1b3a5c   自陣グラデ下
--bg-opp-1     #0d2640   相手陣グラデ上
--bg-opp-2     #2a1b3c   相手陣グラデ下(紫寄り)
--bg-cell      rgba(0,0,0,0.32)   セル内地
```

### Accent
```
--accent-gold  #ffd700   主アクセント(金)
--gold-soft    #ffd75e   evidence/LP 用淡金
--neon-blue    #4ec3ff   情報強調
--neon-yellow  #ffd54a   選択候補
--accent-blue  #3a6ea5   サブ青
```

### Border
```
--border-zone  #3a6ea5   汎用ゾーン枠
--border-self  #44dd99   自陣(緑)
--border-opp   #aa66dd   相手陣(紫)
```

### Card 色(5色 = カード属性)
```
--color-blue    #2b6cb5
--color-yellow  #d4a425   yellowBorder #e0b830(明るい枠)
--color-red     #c84040
--color-green   #3aa67a
--color-purple  #8a4cc0
```

### Stat colors(カード内 AP/LP/Lv)
```
--ap-color     #ff9b6e   攻撃力 — 暖色
--lp-color     #ffd75e   ライフポイント — 金
--lv-color     #6ed1ff   レベル — 寒色
```

### State(キャラ状態)
```
--state-sleep   rgba(40,80,200,0.6)
--state-stun    rgba(220,50,50,0.65)
--state-named   rgba(240,200,40,0.95)
```

### Case status
```
--case-editing  #3366ff   事件編
--case-resolved #ee2255   解決編
```

### Targeting
```
--target-valid    #44dd99
--target-invalid  rgba(238,80,80,0.5)
```

### Text(4 階調)
```
--text-primary    #e0ecf8
--text-secondary  #b8d4f0
--text-muted      #7090b5
--text-disabled   #4a5a70
```

### Pattern
```
--keep-out  repeating-linear-gradient(90deg, #ffd700 0 22px, #0a0a0a 22px 44px)
```

---

## タイポグラフィ

```
--font-jp     "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", -apple-system, sans-serif
--font-mono   "Cascadia Code", "Consolas", "JetBrains Mono", monospace
--font-serif  "Hiragino Mincho ProN", "Yu Mincho", serif
```

### サイズ階層
- **ページタイトル**: 22-32px / fontSerif / 800 / letter-spacing 0.06-0.08em
- **セクションラベル**: 11px / fontMono / 800 / letter-spacing 0.28em / accent-gold
- **本文**: 12-13px / fontJp / 600-700
- **メタ情報**: 10-11px / fontMono / letter-spacing 0.1-0.18em / text-muted
- **数値**: 14-22px / fontMono / 800

### カードサイズ階層(tokens.css 既存)
```
--card-scene  60×84   現場・パートナー
--card-hand   64×90   手札フラット
--card-hand-hover  130×180  ホバー時
--card-detail  250×350  詳細モーダル
--card-file    70×50   FILE(横向き)
--card-evidence  50×70  証拠スタック
--card-case-max  120×86  事件カード(横向き対応)
--card-vs      200×280  VS 演出
```

---

## コアコンポーネント(06-shared.jsx)

### 背景
- **`MetaBg`** — ノワール基調背景 + シーン別装飾オーバーレイ
  - props: `theme` ('noir' | 'crimson'), `scene` ('home' | 'deck' | 'cards' | 'history' | 'tutorial' | 'settings' | 'setup' | 'result' | 'replay')

### ナビゲーション
- **`AppTopBar`** — メタ画面共通の上部バー
  - 高さ 64px / ロゴ + ナビタブ(HOME/DECK/CARDS/TUTORIAL/SETTINGS)+ 勝率・対戦数 + プロフィール
  - 対戦中の TopBar は別実装(高さ 44px、`match-board.html` 内)

### ボタン
- **`SmallButton`** — ツールバー用小ボタン(`className="meta-btn-small"`)
- **`SetupButton`** — 大型ゴースト(BACK / EXPORT 用)
- **`SetupReadyButton`** — シェブロン形のメイン CTA(推理開始)
- **`PrimaryButton`** / **`GhostButton`** — ホーム CTA 用(レガシー)

### カード
- **`MetaCard`** — メタ画面で使うカードサムネ
  - props: `card`, `w`, `selected`, `dimmed`, `count`, `hoverable`, `badge`
  - 内部: `CardSilhouette`(漢字頭文字+役職アイコン+ID シードパターン)

### コンテナ
- **`Panel`**(06-home.jsx) — メタ情報パネル(タイトル+本文)
- **`ArtboardLabel`** — 検証ボード用ラベル

### 状態表現
- **`EmptyState`** — 空状態(6 種アイコン + タイトル + 本文 + CTA)
- **`WarningBanner`** — 警告/エラー/情報の 3 トーン + 項目リスト
- **`LoadingDots`** — 3 点パルススピナー
- **`NetworkStatus`** — 接続状態ピル(online / syncing / offline / error)

### フィルター
- **`FilterGroup`** — チップ群(色/種別/コスト/特徴/キーワード)
- **`Pill`**(06-deck-3col.jsx) — タグ表示
- **`ChipRow`**(06-deck-3col.jsx) — ラベル付きチップ列

---

## インタラクティブ状態(CSS クラス)

`06-shared.jsx` に注入される共通スタイル:

| クラス | 用途 | ホバー時 |
|---|---|---|
| `meta-btn-small` | ツールバー小ボタン | 背景強調 + 枠光 + 1px 浮 |
| `meta-btn-setup` | セットアップ/結果のゴーストボタン | 青強調 + 内部グロー |
| `meta-btn-ready` | メイン CTA(推理開始) | 2px 浮 + 拡大 1.02 + 明度 +8% |
| `meta-card-hover` | カード | 4px 浮 + 拡大 1.03 + 金グロー + 明度 +6% |
| `meta-nav-item` | TopBar ナビ | 金色化 + 薄い金背景 |
| `meta-row` | リスト行 | 青ティント + 2px 右シフト |
| `meta-cta-tile` | ホーム下部 CTA タイル | 4px 浮 + アクセント枠光 + アイコン SVG ドロップシャドウ |
| `meta-chip` | フィルターチップ | 金色化 |

すべて `:focus-visible` で金色 2px outline (a11y)。

トランジションは **110-280ms** の範囲、`cubic-bezier(.2,.7,.3,1)` で統一。

---

## 配色パターン(意味論)

| 用途 | 色 | 例 |
|---|---|---|
| 主要 CTA / 重要情報 | accent-gold | 推理開始ボタン / ヘッダー要約 |
| ナビゲーション | neon-blue | ボタン枠 / リンク |
| 成功 / 勝利 / 進行 | border-self (#44dd99) / green | W バッジ / 解決済 |
| 失敗 / 警告 / 敗北 | red | L バッジ / 違反警告 |
| AI / 相手 / 観察 | purple | OBSERVE モード / 相手陣 |
| 中性情報 | text-muted | メタデータ |

---

## レイアウト規則

- **1920×1080** が基準ステージ。`PrototypeApp` がビューポートに `scale()` でフィット
- **TopBar 64px + SubToolbar 60px** = 上部 124px は共通占有
- **左右余白 24-32px** が画面端パディング
- 内部パネルは **角丸 4px** + **rgba(78,195,255,0.25) 1px border** + **drop-shadow 8px 20px** が標準
- 内部のサブパネルは **rgba(0,0,0,0.4) 背景** + **薄い枠**

---

## 関連ファイル

- `conan/src/ui/styles/tokens.css` — 正式トークン定義
- `conan/design-mockups/01-board-mockup.html` — 対戦中盤面の SoT
- `design-mockups/06-shared.jsx` — メタゲーム実装
- `design-mockups/C-engine-ui-map.md` — エンジン接続マップ
- `design-mockups/C9-modal-review.md` — モーダルカタログレビュー
