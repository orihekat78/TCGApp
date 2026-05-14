# 🤖 engine.effect

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `e7d17a935fd8`

Atom dispatcher / DSL Resolver / Validator

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `run` | `(state: GameState, eff: Effect, ctx: EffectCtx): void` | Effect Descriptor を解釈・実行する。 Immer draft 内 (produce のコールバック) で呼ぶこと。 / |
| `runAtom` | `(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void` | Atom Verb → engine.mutate.* ディスパッチャ 未知の verb は Error を throw する (defensive) / |
| `validate` | `(eff: Effect): ValidationResult` | Validate an Effect Descriptor: - JSON-serializable shape (function values only allowed inside `kind:'custom'`) - atom.verb known - forEach.… |
| `validateCards` | `(defs: CardDef[]): ValidationResult` | Validate an array of CardDef: - ability ids unique within a def - each ability.effect passes engine.effect.validate - ruleRefs entries point to existing files under .claude/rules/… |

---

## ソース

- [`src/engine/effect/index.ts`](../../../src/engine/effect/index.ts)

