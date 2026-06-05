## Engine 拡張 #2: charModifyLevel batch #1 (バーボン B07103/P)

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 2.5

Engine 拡張 #2 (commit `4992110`) の `charModifyLevel` verb を最初に利用するカードとして
バーボン B07103 / B07103P の 2 枚を実装。clean な declared ability 経由で
新 verb の end-to-end 動作を検証。

### 実装カード

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B07103 | 0830 | バーボン | 【登場時】draw1+discard1 chain / 【解決編】【宣言】【ターン1】相手キャラ 1pick level-1 turn |
| B07103P | 0830 | バーボン (parallel) | 同 (rarity 'CP' 違い) |

### 実装パターン (engine 拡張 #2 の使用例)

```ts
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  ...
};
```

PA 短縮形 (`{ player, max, side, delta, scope }`) で declarative に表現できる。`uid` 省略時は
chooser=ctx.source.player に対する pick query が auto-build される (charModifyAP/LP と同型)。

### 修正補足: engine.cards.validate の whitelist 漏れ

新規 verb は `src/engine/effect/validate.ts` の `ATOM_VERBS` セットにも追加する必要がある。
これは Engine 拡張 #2 (4992110) commit に取りこぼしがあった項目で、本 batch で補完:

```diff
- 'charModifyAP', 'charModifyLP', 'charSetAP', 'charSetLP',
+ 'charModifyAP', 'charModifyLP', 'charModifyLevel', 'charSetAP', 'charSetLP',
```

### 検証

- typecheck clean / lint:listener errors=0
- 新規 unit (`tests/cards/charmodifylevel-batch.test.ts`) 4/4 pass
- 全 vitest 1749 pass · 1 skip (回帰 0、baseline 1745 + 新規 4)
- tests/e2e/reuse-cards-2026-06-05.spec.ts 9/9 pass
- ALL_CARDS 871 枚 (+2)

### 残 level±N カード = ~15 枚

- continuous self level mod (B08050/B08059/B09003 等) → 別途 `continuousModifier.levelDelta` 拡張が必要
- 他キャラ enter 反応 (PR096) → matcher が ctx 未取得な制約あり (engine 側に小修正要)
- action declare + 動的条件 (B08048) → 行動 target binding 経由の追加実装
- event chain (B05102 等) → イベント側で同 verb を利用可能、batch #2 で対応予定
- partner-area + declared (B05066/B07093) → 既存パターンで実装可能、batch #2 で対応予定
