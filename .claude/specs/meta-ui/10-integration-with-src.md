# 10 — Phase 11 src/ 統合 (5174 を実機ゲーム + メタ UI 統合版へ)

## 背景

Phase 10 では 5174 を完全独立アプリ (engineStub 模擬対戦) として実装したが、ユーザー意図は「**5173 はそのまま、5173 機能と新 UI を統合した 5174**」だった。Phase 11 はこの認識ズレを是正、`src/` を **完全不変** に保ったまま import 経由で実機エンジン・Playmat・モーダル群を 5174 内に取り込む。

## 不変条件 (絶対遵守)

1. `src/` 配下のコードを **1 行も変更しない** (import のみ)
2. `vite.config.ts` / 既存 `tsconfig.json` / 既存 `tests/` も不変
3. `localhost:5173` の既存ゲーム挙動は完全維持 (回帰ゼロ)

## アーキテクチャ

```
localhost:5173 → src/main.tsx → src/App.tsx [既存、不変]
localhost:5174 → meta-app/src/main.tsx → registerAll() → <App>
                    └─ route='match' → <RealMatchView>
                         └─ src/ から import: Playmat + 14 modals + 4 driver hooks
```

5173 と 5174 は別 JS bundle、import した React tree / zustand instance は各 bundle で独立。

## 主要 import パス

| 用途 | パス |
|---|---|
| エンジン名前空間 | `@/engine` (BUG-034 module duplication 回避のため必ずこの barrel 経由) |
| Playmat | `@/ui/components/Playmat` |
| MulliganModal / GameSetupModal | `@/ui/components/{MulliganModal,GameSetupModal}` |
| 残り 13 modals/overlays | `@/ui/components/{OppTurnOverlay,SpectatorHUD,ReplayPanel,EffectPickerModal,RecentActionToast,DeckRevealOverlay,ContactFlash,RefreshOverlay,VictoryOverlay,TutorialOverlay,HiramekiDemoPickerModal,HiramekiDemoBanner,CutinDemoPickerModal,CutinDemoBanner}` |
| CardArt | `@/ui/components/CardArt` |
| 4 driver hooks | `@/ui/hooks/{useReplayDriver,useEffectPickFlowDriver,useHiramekiDemoDriver,useCutinDemoDriver}` |
| useGameStateStore | `@/ui/state/store` |
| performGameStart | `@/ui/services/gameStarter` |
| AVAILABLE_DECKS / DeckId | `@/ui/services/deckBuilder` |
| registerAll | `@/cards/index` |

## Vite + tsconfig 設定 (meta-app)

```ts
// vite.config.meta.ts
resolve: {
  alias: {
    '@meta': resolve(__dirname, 'src'),
    '@': resolve(__dirname, '../src'),
  },
},
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDir": "..",
    "noUncheckedIndexedAccess": false,    // src/ tsconfig に合わせる
    "types": ["node", "vite/client"],
    "paths": { "@meta/*": ["./src/*"], "@/*": ["../src/*"] }
  }
}
```

## SETUP→MATCH 経路の核心

```ts
// 1. nav('match') を **先に** 実行 → RealMatchView マウント → MulliganModal subscribe
onNav('match');
// 2. performGameStart は async (mulligan UI を side-channel 経由で要求)
performGameStart(undefined, { selfDeckId: 'CT-D08', oppDeckId: 'CT-D11' })
  .then((gs) => useGameStateStore.getState().setGameState(gs));
// 3. MulliganModal が表示 → ユーザー操作 → resolveMulligan → performGameStart 解決
// 4. setGameState で Playmat が描画開始
```

## ResultScreen (gameState ベース)

`useGameStateStore.gameState` を真実の源にし、`engine.read.game.result(gs)` で終局判定。
統計は `gs.turn.number` / `gs.players.*.evidence.length` / `gs.refreshCount` / `gs.scratchTrace` から集計。
クリア時は `useGameStateStore.setState({ gameState: null })` で次対戦に備える。

## カスタムデッキの取扱い

Phase 11 はサンプル 2 デッキ (D08/D11) 専用。任意 DeckRecord → engine DeckSpec への変換は **Phase 12** へ繰越。

## リスク対応 (実装で踏んだ)

- **rootDir エラー**: include `../src/**/*` は rootDir 違反 → paths のみ + `rootDir: ".."` で解消
- **node types エラー**: `tsv-loader-fs.ts` 経路 → `types: ["node", "vite/client"]` 追加
- **noUncheckedIndexedAccess**: 既存 src/ は false 前提 → meta-app/tsconfig も false に合わせる
- **setGameState(null) 型不整合**: 直接 `useGameStateStore.setState({ gameState: null })`

## 検証

- tsc + build green (bundle 581KB、chunk size warning は許容)
- e2e 15 件全緑 (smoke 10 / golden-path 3 (integration 含む) / engine-stub 2)
- 既存 `src/` 不変保証 (`git status -- src/ tsconfig.json vite.config.ts tests/` で何も出ない)
- 5174 で実カード画像 + 実 mulligan modal + 実対戦動作

## 関連
- 上位: [INDEX.md](INDEX.md)
- 原典: `design-mockups_v2/G-integration-plan.md`
- src/App.tsx (133 行) — RealMatchView の構造ミラー元
- 実装: `meta-app/src/{App,screens/RealMatchView,screens/SetupScreen,screens/ResultScreen,shared/MetaCard,util/deckBridge,main}.tsx`
