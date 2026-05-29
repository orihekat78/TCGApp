# 03 — ルーティング (useHashRoute + MetaShell)

## ルート一覧

| ハッシュ | route 名 | レンダー | engineStub 依存 |
|---|---|---|---|
| `#home` (default) | home | HomeScreen | history.winRate / decks |
| `#setup` | setup | SetupScreen | flow.simulateMatch (READY 時) |
| `#match` | match | MatchPlaceholder | (なし、1.2s 後に result へ) |
| `#result` | result | ResultScreen | history.byId / winRate |
| `#deck` | deck | DeckEditor | cards.validateDeck |
| `#cards` | cards | CardsScreen | cards.all + decks (採用集計) |
| `#history` | history | HistoryScreen | history.list / winRate |
| `#replay` | replay | ReplayScreen | history.byId |
| `#tutorial` | tutorial | TutorialScreen | なし |
| `#settings` | settings | SettingsScreen | settings |

## useHashRoute フック (`meta-app/src/router/useHashRoute.ts`)

- `hashchange` イベントを購読
- ハッシュが ROUTES に含まれなければ `DEFAULT_ROUTE='home'` にフォールバック
- `nav(r)` は `window.location.hash = '#' + r`

## MetaShell (`meta-app/src/MetaShell.tsx`)

- `<MetaBg scene={route}>` でシーン別背景
- `key={route}` で React 再マウント → `meta-fade` アニメ発火 (280ms)
- アニメ定義は `interactionStyles.ts` の `@keyframes meta-fade-in`

## 主要遷移エッジ (`E14-screen-flow-spec.md` 準拠)

- home → setup: 「推理開始」/ Enter
- setup → match: READY ボタン (simulateMatch + history.record)
- match → result: 1.2s 自動 (MatchPlaceholder)
- result → setup / replay / home: 各 CTA
- home → deck/cards/history/tutorial/settings: 下段 5 タイル + ショートカット
- history → replay: 「盤面を見る」
- any → home: TopBar / H / Esc

## キーボードショートカット (`useGlobalShortcuts.ts`)

| キー | 動作 |
|---|---|
| H | home |
| D | deck |
| C | cards |
| T | tutorial |
| S | settings |
| P | setup |
| M | match |
| R | result |
| Y | history |
| L | replay |
| Enter (home 時) | setup |
| Esc / Backspace | home |
| ? | HelpOverlay 開閉 |

`input` / `textarea` / `contentEditable` フォーカス中は無効化。Ctrl/Meta/Alt 修飾子付きも無効。

## トランジション仕様

- 切替時間: 280ms
- イージング: `cubic-bezier(.2, .7, .3, 1)`
- 効果: opacity 0→1 + translateY 8px→0 + filter blur 4px→0
- 実装: `meta-fade` CSS クラス + `key={route}` 再マウント

## NavHUD (開発専用 HUD)

`import.meta.env.DEV` で本番ビルドから除外。

- BACK ボタン (history.back)
- 現画面ラベル
- JUMP メニュー (全 10 ルート)
- HOME ボタン
- NetworkStatus (OFFLINE pill — メタは独立アプリのため常時 offline)

## 関連

- 前: [02-design-system.md](02-design-system.md)
- 次: [04-state-stores.md](04-state-stores.md)
- 実装: `meta-app/src/router/*.ts` + `MetaShell.tsx` + `App.tsx`
