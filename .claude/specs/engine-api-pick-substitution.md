# engine-api-pick-substitution

`$pick` placeholder を含む atom を実候補に置換する仕組みの完全仕様。
コードと運用上の不変条件を一元化する (BUG-065〜078 cluster の根本対応の前提)。

## 1. 用語

- **placeholder**: atom args 内の `'$pick'` 文字列、または `target: { kind: 'pick', ... }` 形式の TargetingRef。
- **pick query**: `{ kind: 'pick', query, n: { min, max }, chooser }`。`query` は `engine.target.candidates` に渡される。
- **side-channel**: `globalThis.__pendingEffectPickSide` に格納される `PendingEffectPickSide` オブジェクト (TS 型は [resolve-picks.ts:79-92](../../src/engine/effect/resolve-picks.ts#L79-L92))。
- **初期 walk**: `triggered.ts` などが `event.queue` 直前に `resolveEffectPicks` を呼ぶ pass。state は未進行。
- **runtime walk**: `runAtom` が awaiting-pick path で `tryRePickFromAtom` を呼ぶ pass。state は当該 atom 直前まで進行済。

## 2. 2 つの記述 Pattern

| Pattern | atom args 形 | 代表 atom verb | 解決方式 |
| --- | --- | --- | --- |
| **A** | `{ uid: '$pick', target: pick query, ... }` | `sceneRemove` / `sceneSetState` / `charModifyAP` ほか scene 系 9 verb | `uid` を `picked.uid` に置換、`target` を drop |
| **B** | `{ target: pick query, ... }` (uid 不在) | `discard` / `evidenceToHand` / `handAddFromRemove` | `target` を `[picked.cardId or picked.uid]` 配列に置換 |

Pattern 判定: `isPatternA = args.uid === '$pick'` / `isPatternB = args.uid === undefined`。両方 false なら placeholder ではない → atom 返却。

## 3. AI 経路 (chooseAtomTarget が指定されている)

`triggered.ts` が `HeuristicPolicy.chooseAtomTarget` を渡す。`substituteAtomPick` は cands から best 1 件を選択して即時置換。返却された atom は完全に解決済。

```text
event.queue(resolved atom) → runAllUntilEmpty → runAtom (concrete args)
```

## 4. Human 経路 (humanChooser=true)

### 4.1 初期 walk (triggered.ts → resolveEffectPicks)

- **Pattern A**: side-channel set + atom 未解決返却。caller (event.queue) はそのまま queue。runAtom 時に handler が `uid='$pick'` を見て…現状は **何もしない** (placeholder の atom-handler 自己防衛は将来 task。Listener DSL 化と統合)。
- **Pattern B**: **side-channel set を抑止** (BUG-077 fix)。理由: 初期 walk 時点では sequence の先行 step が未実行で当該 target area が空のことがあり、後続 step が先行 step の target を奪う (D08013 a1)。

### 4.2 runtime walk (atom-handler awaiting-pick → tryRePickFromAtom)

3 verbs (`discard` / `evidenceToHand` / `handAddFromRemove`) のみが該当。`!Array.isArray(a.target)` (PB) または `normalizeTargetToString(a.target) === undefined` (PB 別形) で awaiting と判定。

`tryRePickFromAtom` は `_fromAtomHandler: true` を渡して `substituteAtomPick` を呼ぶ → side-channel set が許可される (state は当該 atom 直前まで進行済なので候補が正しい)。

### 4.3 effectPickResolve dispatch (UI → engine)

[useEngineDispatch.ts:364](../../src/ui/hooks/useEngineDispatch.ts#L364) の `effectPickResolve` case:

1. `pending = store.getState().pendingEffectPick`
2. Pattern A: `resolvedAtom.args = { ...restArgs, uid: picked }`、`target` を drop
3. Pattern B: `resolvedAtom.args = { ...pending.atomArgs, target: [cand.cardId] }`
4. `engineEvent.queue(draft, resolvedAtom, …)` → `runAllUntilEmpty(draft)`
5. post-drain で `store.setPendingEffectPick(null)`

## 5. side-channel guard

`substituteAtomPick(humanChooser branch)` の冒頭で `if (__pendingEffectPickSide) return atom`。これにより sequence 内で複数 atom が awaiting しても **先に set した方が勝つ** (BUG-075)。

## 6. 既知の限界と将来 task

- **L1**: Pattern B のみ awaiting-pick path がある。Pattern A は初期 walk で side-channel set しないと modal が出ない。
- **L2**: sequence の後続 step (step 3 等) が step 2 の resolve 後に再開しない → **BUG-078** (engine 内 re-queue 機構が無い)。
- **L3**: side-channel は globalThis 単発スロット。並列 effect (両 player 同時 pick) は未対応。`pendingPick` を GameState に昇格する re-design は本計画 Pillar 1D 参照 ([plan](../../C:/Users/arumi/.claude/plans/prancy-stirring-reef.md))。

## 7. 関連

- 実装: [resolve-picks.ts](../../src/engine/effect/resolve-picks.ts)、[atom-handlers.ts §discard / evidenceToHand / handAddFromRemove](../../src/engine/effect/atom-handlers.ts)、[useEngineDispatch.ts §effectPickResolve](../../src/ui/hooks/useEngineDispatch.ts)
- 関連 BUG: BUG-035 / BUG-045 / BUG-054 / BUG-065 / BUG-071 / BUG-073 / BUG-074 / BUG-075 / BUG-076 / BUG-077 / BUG-078
- 教訓: [LESSONS-LEARNED §1 side-channel pattern](../bugs/LESSONS-LEARNED.md)、[§11 修正済 transition protocol](../bugs/LESSONS-LEARNED.md)
- 関連 spec: [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)、[engine-api-targeting.md](engine-api-targeting.md)、[engine-api-resolver.md](engine-api-resolver.md)
