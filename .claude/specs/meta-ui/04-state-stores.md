# 04 — 状態管理 (zustand 3 store + persist)

## 方針

zustand + persist middleware で **3 つの独立 store** を実装。namespace は `conan.meta.v1.*`。
**既存 `useGameStateStore` (`src/ui/state/store.ts`) とは完全に分離**、相互参照禁止。

## 3 store 概要 (実装は `meta-app/src/state/*.ts` 参照)

| Store | ファイル | 永続化キー | 役割 |
|---|---|---|---|
| useMetaStore | metaStore.ts | conan.meta.v1.settings | theme / speed / density / spectatorAi |
| useDecksStore | decksStore.ts | conan.meta.v1.decks | カスタムデッキ + SAMPLE_DECK 2 件 seed |
| useHistoryStore | historyStore.ts | conan.meta.v1.history | 模擬対戦履歴 (最大 500 件) |

## metaStore 型

```ts
type ThemeName = 'noir' | 'crimson';
type DensityName = 'compact' | 'comfortable';
interface Settings {
  theme: ThemeName;
  speed: number;          // 0.5〜2.0×
  density: DensityName;
  spectatorAi: number;    // ms
}
interface MetaState {
  settings: Settings;
  _hasHydrated: boolean;
  setSettings: (patch: Partial<Settings>) => void;
}
```

`_hasHydrated` フラグで hydration 完了まで `<MetaShell>` は loading 表示 (mismatch 防止)。

## decksStore 型

```ts
interface DeckRecord {
  id: string;
  name: string;
  partner: string;
  cards: { num: string; count: number }[];
  modified: number;
}
interface DecksState {
  decks: DeckRecord[];
  add(d: Omit<DeckRecord, 'modified'>): void;
  update(id: string, patch: Partial<DeckRecord>): void;
  remove(id: string): void;
  byId(id: string): DeckRecord | undefined;
}
```

初期データ: SAMPLE_DECK (D08) + SAMPLE_DECK_OPP (D11) を seed。

## historyStore 型

```ts
interface MatchRecord {
  id: string;
  recorded: number;
  won: boolean;
  deckName: string;
  oppDeckName?: string;
  mode?: 'solo' | 'observe';
  turns: number;
  duration: number;
  evidGot: number;
  evidLost: number;
  contacts: number;
  hirameki: number;
  misread: number;
  p1Target: 7 | 6;   // F-rule-audit ⚠ 公式準拠
  p2Target: 7 | 6;
  mvp?: string;
}
interface HistoryState {
  history: MatchRecord[];
  record(m: MatchRecord): void;
  byId(id: string): MatchRecord | undefined;
  winRate(deckName?: string): { rate; wins; total };
}
```

500 件で頭打ち (古いものから削除)。

## persist 設定共通パターン

- `version: 1` (将来 schema 変更時に `migrate` callback)
- `onRehydrateStorage` で `_hasHydrated = true` セット
- key prefix `conan.meta.v1.` で既存ゲームの localStorage と分離

## zustand selector 注意点

`useStore((s) => s.array.slice(0, N))` のように selector 内で新配列を返すと React infinite loop。正解: 配列を取得→render 内で slice。10-J e2e で `Maximum update depth exceeded` として検出済 (HomeScreen 修正済)。

## 関連
- 前: [03-routing.md](03-routing.md) / 次: [05-engine-stub.md](05-engine-stub.md)
- 実装: `meta-app/src/state/{metaStore,decksStore,historyStore}.ts`
