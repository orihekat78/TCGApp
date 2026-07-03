# 🤖 engine.dyn

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `7bc10004b7de`

動的式評価（$self.ap / $contact.X / $cost.X / $dyn.X）

## アグリゲータ (`engine.dyn`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `eval`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `evalDyn` | `(state: GameState, expr: string \| number \| boolean, ctx: EffectCtx): DynValue` | Evaluate a dyn expression. If expr is a number/boolean, return as-is. If expr is a string not starting with '$' and not containing operators, return as-is. Otherwise tokenize and evaluate. / |

---

## ソース

- [`src/engine/dyn/index.ts`](../../../src/engine/dyn/index.ts)

