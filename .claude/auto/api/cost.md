# 🤖 engine.cost

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `93e75b73276d`

コスト判定（canPay / pay）+ viaCost フラグ管理

## アグリゲータ (`engine.cost`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `canPay`
- `pay`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `canPay` | `(state: GameState, cost: Cost, ctx: EffectCtx): boolean` | Check if a Cost is fully payable in the given state. / |
| `pay` | `(state: GameState, cost: Cost, ctx: EffectCtx): PayResult` | Pay a Cost. Mutates the draft in place. Sets ctx.viaCost = true while executing. Restores prior value when done. / |

---

## ソース

- [`src/engine/cost/index.ts`](../../../src/engine/cost/index.ts)

