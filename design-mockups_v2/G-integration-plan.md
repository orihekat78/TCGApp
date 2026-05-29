# G — リポジトリ統合設計

`conan/` 既存実装と `design-mockups/` で作ったメタゲーム UI を統合するための設計書。

---

## 1. 既存実装の現状把握

### スタック
- **Vite + React 19 + TypeScript** (`vite.config.ts` で `@/` = `src/`)
- 状態管理: **Zustand**(`@/ui/state/store.ts`)+ immer
- 単一ルート: `src/App.tsx` → `index.html`(`#root` mount)
- スタイル: CSS Module 風(各コンポ `.css` 同梱)+ `@/ui/styles/tokens.css`

### 既存スコープ
- **対戦中(MATCH)に特化**した実装。`App.tsx` は基本 `<Playmat>` を出すだけ
- 起動時 `gameState === null` → **GameSetupModal** が表示され、デッキ選択 → `performGameStart()` → setGameState
- それ以外のメタゲーム画面(HOME / DECK / CARDS / HISTORY / TUTORIAL / SETTINGS)は **未実装**
- 既存「画面」とは事実上「対戦画面」のみで、その内部に多数のモーダル / オーバーレイがある

### Store の現状
`useGameStateStore` は以下を保持:
- `gameState` (engine state) / `setGameState` / `dispatch`
- `activeActionId` / `pendingHirameki` / `pendingMisread` / `pendingEffectPick` / `pendingDeckReveal`
- `spectatorMode` / `aiSpeedMs` / `isAiPaused` / `aiStepCounter`
- `hiramekiDemoMode` / `cutinDemoMode`(検証用)

→ **対戦専用の store**。メタゲーム用の状態(現在画面 / 保存デッキ / 履歴 / 設定)は別 store として分離するのが正解。

### サービス層
- `gameStarter.ts` — `performGameStart()`: engine setup + マリガン
- `deckBuilder.ts` — `AVAILABLE_DECKS` (現在 D08 / D11 の 2 つ)、`buildDeckPair`
- `cardResolvers.ts` — カード ID → CardDef 解決
- `cardImage.ts` — 画像 URL 解決(著作権上空のはず)

→ `deckBuilder` を拡張して **カスタムデッキ**(localStorage 由来)を受け付ける形が自然。

---

## 2. 統合設計の基本方針

### A. 既存対戦体験は壊さない
- `<Playmat>` + GameSetupModal + 16+ モーダル/オーバーレイの組み合わせは **そのまま温存**
- 新規ルーターは対戦画面を 1 ルートとして包含する形

### B. メタゲーム = 対戦の周囲を覆うシェル
- `App.tsx` の `<></>` ルート直下に **`<MetaShell>`** を挟む
- `<MetaShell>` がルーティングを担当:
  - `gameState !== null` または `route === 'match'` → 既存 `<Playmat>` + モーダル群を render
  - それ以外 → メタ画面(`<HomeScreen>` / `<DeckEditor>` / etc.)を render
- GameSetupModal は **SETUP ルートに昇格**(モーダルから単独画面へ)

### C. 状態を分離する
- 対戦用: 既存 `useGameStateStore`(変更なし)
- メタ用: 新規 `useMetaStore`(zustand)で URL ルート + 保存デッキ + 履歴 + 設定
- メタ ↔ 対戦 のブリッジ: `useMetaStore` の "対戦開始" アクションが `performGameStart()` を呼んで `useGameStateStore.setGameState()` を実行

### D. プロトタイプの JSX → TSX 移植
- `design-mockups/` の JSX はすべて `window.*` グローバル前提 → 個別 `.tsx` モジュールに分解
- 共通プリミティブ(`MetaBg` / `MetaCard` / `SmallButton` / 等)は `src/ui/meta/shared/` に置く
- 画面コンポーネントは `src/ui/meta/screens/{Home,Deck,Cards,History,Tutorial,Settings,Result}/`

---

## 3. 推奨ディレクトリ構成

```
conan/src/ui/
├── components/        ← 既存(対戦内 UI)、変更なし
├── meta/              ← 新規
│   ├── MetaShell.tsx          ← ルートシェル(ルーティング判定)
│   ├── shared/
│   │   ├── tokens.ts          ← T オブジェクトを TS 化
│   │   ├── MetaBg.tsx
│   │   ├── MetaCard.tsx
│   │   ├── AppTopBar.tsx
│   │   ├── Button.tsx         ← SmallButton / SetupButton / SetupReadyButton 統合
│   │   ├── FilterGroup.tsx
│   │   ├── EmptyState.tsx
│   │   ├── WarningBanner.tsx
│   │   └── NavHUD.tsx         ← 開発用フローティング HUD(本番では非表示可)
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── SetupScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── DeckEditor.tsx
│   │   ├── CardsScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   ├── TutorialScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── state/
│   │   ├── metaStore.ts       ← URL ルート + 設定
│   │   ├── decksStore.ts      ← カスタムデッキ管理(localStorage)
│   │   └── historyStore.ts    ← 試合履歴
│   ├── services/
│   │   ├── matchRecorder.ts   ← gameState 終局 → history 保存
│   │   └── deckValidator.ts   ← engine.cards.validateDeck wrapper
│   └── router.ts              ← ハッシュルーティング
└── state/             ← 既存、変更なし
```

---

## 4. ルーティング設計

### URL ハッシュ → ルート

| ハッシュ | ルート | レンダー |
|---|---|---|
| `#home`(default) | home | `<HomeScreen>` |
| `#setup` | setup | `<SetupScreen>` (既存 GameSetupModal の中身を画面化) |
| `#match` | match | 既存 `<Playmat>` + モーダル群(gameState が必要) |
| `#result` | result | `<ResultScreen>`(gameResult 確定時に自動遷移) |
| `#deck` | deck | `<DeckEditor>` |
| `#cards` | cards | `<CardsScreen>` |
| `#history` | history | `<HistoryScreen>` |
| `#tutorial` | tutorial | `<TutorialScreen>` |
| `#settings` | settings | `<SettingsScreen>` |

### MetaShell の判定ロジック
```tsx
function MetaShell() {
  const route = useMetaStore(s => s.route);
  const gameState = useGameStateStore(s => s.gameState);

  // gameState がある & 終局していない → 強制 match 表示
  if (gameState && !engine.read.gameResult(gameState).isOver) {
    return <MatchView />;  // 既存 App.tsx の中身
  }

  // gameState がある & 終局済 → result 画面
  if (gameState && engine.read.gameResult(gameState).isOver && route !== 'home') {
    return <ResultScreen />;
  }

  // それ以外 → route 通りにメタ画面
  return <MetaScreenSwitch route={route} />;
}
```

### 遷移トリガー
- SETUP の「対戦開始」 → `performGameStart()` → setGameState → MetaShell が自動的に MatchView へ
- MATCH の `engine.read.gameResult` が `isOver` になる → MetaShell が ResultScreen へ
- ResultScreen の「次へ」 → setGameState(null) + setRoute('setup')

---

## 5. メタ store 設計

```ts
// metaStore.ts
type MetaStore = {
  route: Route;
  setRoute: (r: Route) => void;
  // 設定
  settings: { theme: string; speed: number; density: string };
  setSettings: (patch: Partial<...>) => void;
  // 永続化
  hydrate: () => void;
  persist: () => void;
};

// decksStore.ts
type DeckRecord = {
  id: string;
  name: string;
  partner: CardId;
  cards: { num: CardId; count: number }[];
  modified: number;
};
type DecksStore = {
  decks: DeckRecord[];
  add(d: DeckRecord): void;
  update(id: string, d: Partial<DeckRecord>): void;
  delete(id: string): void;
};

// historyStore.ts
type MatchRecord = {
  id: string;
  won: boolean;
  /* MVP / turns / dur / contacts / hirameki / misread / evidGot / evidLost / p1Target / p2Target */
  // ...
  recorded: number;
};
type HistoryStore = {
  history: MatchRecord[];
  record(m: MatchRecord): void;
  winRate(deckName?: string): { rate, wins, total };
};
```

すべて localStorage 永続化(zustand `persist` middleware 使用)。

---

## 6. SETUP 画面の取り扱い

既存 `GameSetupModal` には:
- self / opp デッキ選択
- リプレイ JSON ロード
- 観戦モード ON/OFF
- ヒラメキ/カットインデモ起動

→ これらをすべて **`<SetupScreen>` のセクション**として再配置:
- メインセクション: モード選択(SOLO / OBSERVE)+ デッキ選択 2 ペイン + READY ボタン(`design-mockups/08-setup.jsx` のレイアウト準拠)
- アドバンスドセクション(折りたたみ): リプレイロード + デモ起動

旧 `GameSetupModal.tsx` は **削除せず** `<SetupScreen>` のサブコンポーネントとして再利用。

---

## 7. 試合履歴の自動記録

`useMatchRecorder` フックを `MetaShell` 内で監視:
```ts
useEffect(() => {
  if (gameState && engine.read.gameResult(gameState).isOver) {
    const record = buildMatchRecord(gameState);
    historyStore.record(record);
  }
}, [gameState]);
```

`buildMatchRecord(gameState)` は engine の `event.history` を集計して MatchRecord 形式に変換。

---

## 8. デッキ編集 ↔ 既存 deckBuilder の接続

現状 `deckBuilder.ts` は `CT-D08` / `CT-D11` のハードコード。

**拡張案**:
1. `decksStore` から `DeckRecord` を取得
2. `DeckRecord` → engine の `DeckPair['self']` に変換する `convertToDeckSpec(record)` を追加
3. `buildDeckPair` を拡張: `{ selfDeckId?: DeckId; selfCustomId?: string; oppDeckId?: DeckId; oppCustomId?: string }`
4. `performGameStart` の引数を `{ selfDeck: DeckRecord | DeckId; oppDeck: DeckRecord | DeckId }` 形式に

→ デッキ編集画面で保存したデッキが対戦準備画面で選択可能になる。

---

## 9. カード画像の取扱い

- 既存 `cardImage.ts` がカード ID → URL を解決(著作権上同梱なし → 空 URL → silhouette フォールバック)
- メタゲーム側の `MetaCard` は現状 `CardSilhouette`(漢字頭文字 + 役職アイコン)を使用
- **統一**: `CardArt` コンポーネント(対戦用)も silhouette フォールバックを使うように調整、または `CardSilhouette` を `MetaCard` 専用に留める

推奨: 対戦内は既存 `CardArt`(高密度向け)、メタは `CardSilhouette`(大きく見せる用)で **使い分け**。

---

## 10. 段階的移行プラン(Phase 10)

| Phase | 内容 | 工数目安 |
|---|---|---|
| **10-A** | metaStore / decksStore / historyStore を TS で起こす + localStorage persist | 1 日 |
| **10-B** | `src/ui/meta/shared/` に共通プリミティブを TS で移植 | 2 日 |
| **10-C** | `<MetaShell>` + ルーティング + 既存 App との接続 | 1 日 |
| **10-D** | `<HomeScreen>` + `<SettingsScreen>`(最小機能) | 1.5 日 |
| **10-E** | `<SetupScreen>`(既存 GameSetupModal 統合) | 1.5 日 |
| **10-F** | `<ResultScreen>` + 自動遷移 + 履歴記録 | 1 日 |
| **10-G** | `<HistoryScreen>` + `<DeckEditor>` + `<CardsScreen>` | 4 日 |
| **10-H** | `<TutorialScreen>`(章 04 + ヒラメキ図解の実装含む) | 2 日 |
| **10-I** | プロトタイプの遷移演出 / キーボードショートカット移植 | 1 日 |
| **10-J** | E2E テスト(Playwright)+ メタゲーム動作確認 | 1.5 日 |

**合計 16.5 日 ≒ 3 週間**(エンジニア 1 名)

---

## 11. 開発時の注意点

### 既存テストへの影響
- `tests/` 配下の対戦テストは `<Playmat>` 直接マウントが多いはず → MetaShell 経由でも動くことを確認
- `gameState === null` で `<MetaShell>` が `<HomeScreen>` を出すため、既存「起動 → GameSetupModal」フローのテストは要調整

### Strict Mode と副作用
- `App.tsx` は StrictMode 配下 → useEffect の 2 重発火に注意
- `MetaShell` の `useMatchRecorder` は重複記録防止が必要(`record.id` で dedupe)

### スタイル衝突
- 既存 CSS Module は `.tsx` ごと(`Playmat.css` 等)
- `meta/shared/` は CSS-in-JS スタイル(プロトタイプから引き継ぎ)を採用
- グローバル `tokens.css` は共通参照

### TypeScript 化での型整理
- プロトタイプは `card: any` などの暗黙 any が多い → CardDef 型を共有
- `engineStub.flow.simulateMatch` の output 形を TS 型定義 (`MatchSummary`) に正規化

---

## 12. リスクと未解決事項

| リスク | 対応 |
|---|---|
| 既存 `<Playmat>` が gameState 必須前提 | MetaShell で null チェック後にレンダリング |
| 既存 GameSetupModal のヒラメキ/カットインデモ | SETUP 内のアドバンスドセクションに退避 |
| 既存テストが GameSetupModal を直接参照 | テスト側を SetupScreen 経由に書き換え |
| spectator mode の状態が gameStateStore に存在 | metaStore へ昇格 or 既存維持(後者推奨、対戦専用フラグなので) |
| ヒラメキ/カットイン demo の起動 UI | SetupScreen 内のデバッグメニューとして残置 |

---

## 13. 完成イメージ

```
┌─────────────────────────────────────────────────┐
│ #root                                            │
│  └─ <App>                                        │
│      └─ <MetaShell>                              │
│          ├─ route='home' → <HomeScreen>          │
│          ├─ route='setup' → <SetupScreen>        │
│          ├─ route='match' (gameState!=null)      │
│          │   └─ <Playmat> + 16 モーダル          │
│          ├─ route='result' (isOver) → <ResultScreen>
│          ├─ route='deck' → <DeckEditor>          │
│          ├─ route='cards' → <CardsScreen>        │
│          ├─ route='history' → <HistoryScreen>    │
│          ├─ route='tutorial' → <TutorialScreen>  │
│          └─ route='settings' → <SettingsScreen>  │
└─────────────────────────────────────────────────┘
```

URL ハッシュは `metaStore` と同期、ブラウザ戻る/進むも動作。

---

## 関連

- `design-mockups/memory.md` — モック側の現状
- `design-mockups/E15-component-guide.md` — コンポーネント実装ガイド(旧版)
- `design-mockups/C-engine-ui-map.md` — engine 関数対応
- `conan/src/App.tsx` — 既存ルート
- `conan/src/ui/state/store.ts` — 既存対戦 store
- `conan/.claude/research/plans/2026-05-11-mvp-implementation/phase-9-polish.md` — Phase 9 計画(本書は Phase 10 として位置付け)
