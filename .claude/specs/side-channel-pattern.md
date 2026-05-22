# Side-Channel Pattern — engine ↔ UI 通信規約

LESSONS-LEARNED 教訓 1 (BUG-006/029/034/054) を踏まえた、engine listener
が UI に「ユーザー入力待ち state」を渡す pattern の定義。

## なぜ必要か

engine listener (hirameki / misread / effect-pick 等) は React 外で動作する
ため、`useTargetPicker` 等の UI hook を await できない。代わりに globalThis
の side-channel に「pending state」を書き込み、UI 側 dispatch の post-step で
drain → store に転送 → modal が render する経路で連携する。

## 4 点 checklist

新規 side-channel 導入時は以下 **4 点を必ず同 PR で配線**:

### 1. globalThis 側チャネル定義 (engine 側)

`src/engine/listeners/<topic>.ts` or `src/engine/effect/<helper>.ts` で:

```ts
declare global {
  // eslint-disable-next-line no-var
  var __pendingXxxSide: PendingXxxSide | null | undefined;
}
export type PendingXxxSide = { player, ..., source };

function setPendingXxxSide(v: PendingXxxSide | null): void {
  (globalThis as { __pendingXxxSide?: ... }).__pendingXxxSide = v;
}

export function _drainPendingXxxSide(): PendingXxxSide | null {
  const v = (globalThis as ...).__pendingXxxSide ?? null;
  setPendingXxxSide(null);
  return v;
}
```

vite dev mode の module instance 分離回避のため必ず globalThis 経由
(BUG-034 の真因)。

### 2. listener / atom handler 側で set

```ts
if (条件: human player / hirameki 発動 / etc) {
  setPendingXxxSide({ player, ..., source });
  return; // queue 抑止 (UI 側で resolve 後 re-queue)
}
```

### 3. UI dispatch で drain → store 反映

`src/ui/hooks/useEngineDispatch.ts` の `runEngineAction` 末尾:

```ts
const xxxSide = _drainPendingXxxSide();
if (xxxSide) {
  store.setPendingXxx(xxxSide);
}
if (action.type === 'xxxResolve') {
  store.setPendingXxx(null);
}
```

### 4. UI 側 store + modal + resolve action

- `src/ui/state/store.ts`: `pendingXxx: PendingXxx | null` field + setter
- `src/ui/components/XxxModal.tsx`: `pendingXxx !== null && player === 'self'`
  で render、選択 → dispatch
- `src/ui/hooks/useEngineDispatch.ts`: 新 action `xxxResolve` で
  bindings 置換 → event.queue
- `src/ui/hooks/useXxxFlowDriver.ts` (optional): AI side の auto-resolve
  fallback

## 既存実装の参照

| pattern | engine 側 | UI 側 modal | dispatch action |
|---|---|---|---|
| hirameki | `src/engine/listeners/hirameki.ts` | `HiramekiPickerModal` | `hiramekiResolve` |
| misread | `src/engine/listeners/misread.ts` | `MisreadPickerModal` | `misreadResolve` |
| effect-pick (BUG-054) | `src/engine/effect/resolve-picks.ts:setPendingEffectPickSide` | `EffectPickerModal` | `effectPickResolve` |

## 関連

- BUG-006 (driver reactivity 修正 — 初期 pattern 発見)
- BUG-029 (副次解消 — 同 pattern を misread にも適用)
- BUG-034 (vite module isolation 真因 — globalThis 必須化)
- BUG-054 (effect-pick で本 pattern を踏襲)
- [LESSONS-LEARNED.md](../bugs/LESSONS-LEARNED.md) 教訓 1
