# 🤖 engine.target

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `0625da967872`

候補抽出 + 選択検証（split-name / distinctNames 含む）

## アグリゲータ (`engine.target`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `candidates`
- `legalCount`
- `resolve`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `allCardNameComponentsForDef` | `(d: CardDef): string[]` | Get all card-name components for a CardDef, factoring in rules/19 split-name cards. Combines CardDef.names with any further splitting on each name. / |
| `candidates` | `(state: GameState, ref: TargetingRef, ctx: EffectCtx): Candidate[]` | Enumerate candidates for a TargetingRef. / |
| `cardNameComponents` | `(name: string): string[]` | Split a card name into components per rules/19. Splits on '&', '『 』', '( )'. Example: "江戸川コナン&工藤新一" -> ["江戸川コナン&工藤新一", "江戸川コナン", "工藤新一"] The original name is always included as a component. / |
| `legalCount` | `(state: GameState, ref: TargetingRef, ctx: EffectCtx): { min: number; max: number }` | Legal count range. / |
| `resetCardDefLookup` | `(): void` |  |
| `resolve` | `(state: GameState, ref: TargetingRef, ctx: EffectCtx, picked?: Candidate[]): Candidate[]` | Resolve a TargetingRef into the final list of Candidates. - 'self' / 'all' / 'fromBound' → auto-resolve (picked ignored) - 'pick' → validate `picked` against query + count range + distinctNames / |
| `setCardDefLookup` | `(fn: CardDefLookup): void` |  |

---

## ソース

- [`src/engine/target/index.ts`](../../../src/engine/target/index.ts)

