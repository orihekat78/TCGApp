# 05 — engineStub TS 化

## 方針

`design-mockups_v2/10-engine-stub.jsx` (localStorage-backed フェイク) を TS 化して `meta-app/src/stubs/engineStub.ts` に配置。本物 engine (`src/engine/`) には **一切依存しない**。

## エクスポート構造

```ts
export const engineStub = {
  cards: cardsApi,
  decks: decksApi,
  history: historyApi,
  settings: settingsApi,
  flow: flowApi,
} as const;
```

各 namespace を以下で実装。store 連携は zustand `getState/setState` 経由。

## cards namespace

- `all(): readonly CardDef[]` — CARD_POOL 全件
- `byNum(num: string): CardDef | undefined`
- `validateDeck(deck: DeckRecord): { ok: boolean; errors: string[] }`

検証ルール (rules/02-deck-construction.md 準拠):
- 40 枚ちょうど
- 同 ID 上限 3 枚
- パートナー必須 (1 枚)
- デッキにパートナー/事件カードを入れない

## decks / history / settings namespace

それぞれ対応する zustand store の薄いラッパー。`getState()` 経由で読み書き。

```ts
const decks = {
  list: () => useDecksStore.getState().decks,
  byId, add, update, remove,
};
const history = {
  list, byId, record, winRate,
};
const settings = {
  get: () => useMetaStore.getState().settings,
  set: (patch) => useMetaStore.getState().setSettings(patch),
};
```

## flow.simulateMatch (シード固定フェイク)

```ts
interface SimulateParams {
  p1Deck: DeckRecord;
  p2Deck: DeckRecord;
  mode?: 'solo' | 'observe';
  difficulty?: '初級' | '標準' | '上級';
  seed?: number;
  firstPlayer?: 'p1' | 'p2';
}
flow.simulateMatch(params): MatchRecord
```

挙動:
- 線形合同 RNG (seed → 決定的)
- deck 強度 = 平均コスト + AP 合計の関数
- difficulty 補正 (-20 / 0 / +20)
- 勝敗 + ターン数 + 証拠 + コンタクト + ヒラメキ + ミスリード をフェイク生成
- MVP は p1Deck 内の character からランダム選出

### F-rule-audit ⚠ 高優先度修正

`p1Target` / `p2Target` を **先攻 7 · 後攻 6** に修正 (rules/01-victory-conditions.md 準拠)。
原典 JSX の `targetEv = 4` ハードコード違反を本実装で解消。

## CARDS と DECK の独立コピー

CARD_POOL (27 枚: D08 系 + D11 系) は `meta-app/src/data/cardPool.ts` に **意図的に独立コピー**。
`src/engine/cards/` との重複を許容、将来 Phase 11 で同期検討。

## ユニットテスト (10-C / 10-J で実施)

- `cards.validateDeck`: 40枚 / 39枚 / 41枚 / 同ID 4 枚 / パートナー混入 → エラー検出
- `flow.simulateMatch`: 同 seed で同じ結果 (determinism)、firstPlayer で p1Target 正しい
- `history.record`: 500 件超で古いものから削除
- persist round-trip: store mutate → 別 hook read → 同値

e2e (engine-stub.spec.ts) で:
- `localStorage` キーが `conan.meta.v1.*` のみ (既存ゲームと無干渉)
- simulateMatch 後の RESULT で証拠 / 7 (or / 6) 表示
- history 1 件記録される

## 関連
- 前: [04-state-stores.md](04-state-stores.md)
- 次: [06-screens-play-flow.md](06-screens-play-flow.md)
- 原典: `design-mockups_v2/10-engine-stub.jsx` + `F-rule-audit.md`
- 実装: `meta-app/src/stubs/engineStub.ts`
