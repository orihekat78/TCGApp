# 🤖 engine.cond

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `034395312a5a`

26 Condition variants 評価

## アグリゲータ (`engine.cond`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `eval`
- `evalAll`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `evalAll` | `(state: GameState, cs: Condition[], ctx: EffectCtx): boolean[]` |  |
| `evalCond` | `(state: GameState, cond: Condition, ctx: EffectCtx): boolean` | Evaluate a Condition to boolean using current state + ctx. / |

---

## ソース

- [`src/engine/cond/index.ts`](../../../src/engine/cond/index.ts)

