# E-15 — コンポーネント実装ガイド

各モックを React 実装に落とし込む際のメモ。状態管理・props 設計・engine 接続点を整理。

---

## 全体方針

- 既存実装(`conan/src/ui/components/`)は対戦中(MATCH)のみ。**メタゲーム部分は新規実装**が必要。
- メタゲームは engine 依存が薄い(`C-engine-ui-map.md` 参照)→ 独立した React 機能として実装可。
- localStorage を主データストアにすれば、エンジン接続なしで全機能動作可。

---

## 推奨ディレクトリ構成

```
conan/src/ui/
  components/            (既存 — match 専用)
  meta/                  (新規 — メタゲーム)
    HomeScreen/
    SetupScreen/
    ResultScreen/
    DeckEditor/
    CardsScreen/
    HistoryScreen/
    ReplayScreen/
    TutorialScreen/
    SettingsScreen/
  shared/                (新規 — メタ共通)
    AppTopBar.tsx
    MetaCard.tsx
    MetaBg.tsx
    SmallButton.tsx
    SetupButton.tsx
    EmptyState.tsx
    WarningBanner.tsx
    LoadingDots.tsx
    NetworkStatus.tsx
  router/
    Router.tsx
    routes.ts
  state/                 (既存 + 拡張)
    decks.ts             (localStorage で 4-12 デッキ管理)
    history.ts           (試合履歴)
    tutorial.ts          (進捗)
    settings.ts          (アプリ設定)
    campaign.ts          (ストーリー進捗)
```

---

## 状態管理

### 種類別ストア

| ストア | スコープ | 永続化 |
|---|---|---|
| **AppState** | アプリ全体(現在画面、HUD 表示など) | URL ハッシュ |
| **MetaState** | デッキ・履歴・設定・進捗 | localStorage |
| **MatchState** | 対戦中の engine state | メモリのみ(対戦終了で破棄→履歴に保存) |

### 推奨パターン

- メタゲーム: **React Context + useReducer** で各ストア(decks / history / settings)を分離
- 対戦中: **既存の engine API**(produce 使用の immutable state)をそのまま利用
- 共有: SETUP 画面で構築した `MatchConfig` → MATCH へ props で渡す

### URL ルーティング

`09-app.jsx` の `useHashRoute` パターンを採用。本番では React Router の `HashRouter` 推奨:

```tsx
<HashRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/setup" element={<Setup />} />
    <Route path="/match" element={<Match />} />
    ...
  </Routes>
</HashRouter>
```

---

## コンポーネント実装の落とし穴

### MetaBg
- `scene` ごとの装飾は SVG + 半透明オーバーレイで、**ピクセル比率に依存しない実装**
- パフォーマンス注意: 各画面ごとに 100+ 個の `<circle>` を描画していないか
- 推奨: シーンオーバーレイは memoize して再レンダリング抑制

### MetaCard
- props: `card`, `w`, `selected`, `dimmed`, `count`, `hoverable`, `badge`
- 内部の `CardSilhouette` は `card.num` を seed にした SVG パターン生成
- ホバー時の transform はネイティブ CSS(`meta-card-hover`)で。React state で hover 管理しない

### AppTopBar
- ナビ items は **route 名と一致** させる(`HOME`→`home`)
- 勝率・対戦数は `useEffect` で localStorage から取得 → 表示時にメモ化
- プロフィール枠は将来の "TODAY'S CASE" 通知バッジ用に余地を残す

### SetupReadyButton
- シェブロン形は `clip-path: polygon(...)` で実現。border は **clip-path 適用後の見えない領域に出る** ので、box-shadow + 内側 border で代替
- 押下時のフィードバック: `transform: translateY(0)` で `:active` 戻り

### DeckEditor3Col / DeckEditorMD
- 大量のカードをレンダリングするため `React.memo` + key 戦略が重要
- カードプール 47 枚は OK だが、何百枚規模になったら virtualization 必要
- ドラッグ&ドロップ: React DnD or @dnd-kit/core 推奨

### Tweaks 連携
- `TweaksPanel`(starter component)を使うなら、各画面の Tweaks は `useTweaks()` で監視
- 例: HOME の右レーン表示 ON/OFF を Tweaks で切り替え可能に

---

## アクセシビリティ

- **a11y outline**: 06-shared.jsx の `:focus-visible` で実装済(金色 2px)
- **Esc キー**: モーダル / ヘルプの汎用閉じる
- **キーボード操作**: Tab で全要素フォーカス可能であること
- **aria-label**: SVG ボタンには必須(現状は `data-nav-to` 経由で機能してるが、ラベルを追加)
- **コントラスト比**: メイン文字 `#e0ecf8` on `#0a1a28` は WCAG AAA 余裕クリア

---

## パフォーマンス目標

| 指標 | 目標 |
|---|---|
| 初期ロード | <2 秒 (Vite + コード分割) |
| 画面遷移 | <300ms (アニメーション含む) |
| カードグリッド描画 | <100ms (47 枚) |
| デッキ検証 | <50ms (40 枚) |
| 対戦中の 1 アクション | <50ms (engine + UI 更新) |

---

## テスト戦略

- **ユニット**: 各メタストアの reducer / 検証ロジック(Vitest)
- **インタラクション**: 画面遷移を Playwright で(既存 `conan/tests/` 拡張)
- **ビジュアル回帰**: 全画面のスクリーンショット差分(Playwright)
- **アクセシビリティ**: axe-core 統合

---

## 移行スケジュール案

| Phase | 内容 | 工数目安 |
|---|---|---|
| 9-A | shared/ 共通プリミティブを TypeScript 化 | 2-3 日 |
| 9-B | HomeScreen + SetupScreen の本実装 | 3-4 日 |
| 9-C | DeckEditor 本実装 + 検証連携 | 3-4 日 |
| 9-D | History / Replay / Cards | 4-5 日 |
| 9-E | Tutorial / Settings | 2-3 日 |
| 9-F | アニメーション・ポリッシュ | 2-3 日 |

**総計 16-22 日**(エンジニア 1 名)

---

## 関連

- `design-mockups/E13-design-system.md` — トークン・コンポーネント定義
- `design-mockups/E14-screen-flow-spec.md` — 画面遷移仕様
- `design-mockups/C-engine-ui-map.md` — エンジン関数対応
- `design-mockups/C9-modal-review.md` — モーダル仕様
- `conan/.claude/specs/2026-05-11-ui-*` — UI 詳細仕様(ルール準拠)
