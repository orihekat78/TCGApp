# 🤖 engine.effect

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `5d06d854e23e`

Atom dispatcher / DSL Resolver / Validator

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `run` | `(state: GameState, eff: Effect, ctx: EffectCtx): void` | Effect Descriptor を解釈・実行する。 Immer draft 内 (produce のコールバック) で呼ぶこと。 / |
| `runAtom` | `(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void` |  |
| `validate` | `(eff: Effect): ValidationResult` | Validate an Effect Descriptor: - JSON-serializable shape (function values only allowed inside `kind:'custom'`) - atom.verb known - forEach.… |
| `validateCards` | `(defs: CardDef[]): ValidationResult` | --- engine.cards.validate --- Validate an array of CardDef (pure): - ability ids unique within a def - each ability.effect passes engine.effect.… |

---

## ソース

- [`src/engine/effect/index.ts`](../../../src/engine/effect/index.ts)

