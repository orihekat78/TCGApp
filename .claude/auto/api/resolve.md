# 🤖 engine.resolve

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `76ec76e019c2`

Effect Stack（queue/next/runOne + cancel/replace/lock）

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `cancel` | `(state: GameState, entryId: string): void` | Mark an entry cancelled by id (no-op if missing or not pending). Used by "〜を無効にする" effects (rules/15 即時例外). / |
| `isLocked` | `(_state: GameState): boolean` |  |
| `lock` | `(_state: GameState, reason: string): void` |  |
| `next` | `(state: GameState): EffectStackEntry \| null` | Determine the next entry to resolve, per rules/15 + rules/25. Returns null if no pending entry exists. / |
| `peek` | `(state: GameState): EffectStackEntry[]` | Snapshot of pendingEffects regardless of state — for UI / debug. Returns a shallow copy of the array (entries themselves are shared). / |
| `queue` | `(state: GameState, entry: EffectStackEntry): void` | Push an entry into pendingEffects. Callers (event.queue / event.emit / card listeners) already provide a fully built entry. / |
| `replace` | `(state: GameState, entryId: string, newEffect: Effect): void` | Replace the Effect on a pending entry (id-keyed). Used by "代わりに〜" effects (rules/15 即時例外). @see Effect.… |
| `runAllUntilEmpty` | `(state: GameState): void` | Drain the stack until no pending entries remain. New entries queued during resolution are picked up automatically (rules/15 "未解決"). Safety cap: 1000 iterations. / |
| `runOne` | `(state: GameState, entry: EffectStackEntry): void` | Resolve one entry: 1. state -> 'resolving' + emit effect:resolve:start 2. resolveGuard が false なら 'cancelled' して return (cancel した場合は effect:resolve:end は emit しない) 3. ctx を作って engine.effect.… |
| `unlock` | `(_state: GameState): void` |  |

## その他のエクスポート

- `resolve` _(other)_

---

## ソース

- [`src/engine/resolve/index.ts`](../../../src/engine/resolve/index.ts)

