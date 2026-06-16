# BUG-111 #2 修正設計 — human-decline 経路の continuation 取り扱い

> 骨格凍結原則の **例外 (engine 自体のバグ修正)**。opus 敵対設計レビュー対象。
> rules: 15-abilities-effects.md / 25-qa-effects-resolution.md / 16-card-set.md

## 確定した根本原因 (再現で実証、2026-06-16)

`tests/engine/effect/bug-111-human-decline-repro.test.ts` で ground truth を確定:

| ケース | 経路 | 結果 |
|---|---|---|
| chain[0-pick, sceneRemove] decline (B05028 a1 同型) | useDeclaredAbility | step2 **不発火 (正)** |
| 同上 | フル dispatchEngineAction(declaredAbility) | step2 **不発火 (正)** |
| sequence[0-pick, draw] decline | フル dispatch | draw **drop (バグ)** |
| chain control | AI auto-pick | step2 発火 (masking 実証) |

**結論**:
1. **実バグは under-fire のみ**: `sequence[optional-0-pick, ...tail]` の 0-pick を **human-decline** すると、
   pending 破棄 → continuation (= 末尾 step 群) も破棄され、**末尾の mandatory step が drop** する。
   `skipResolvesAtom=false` (deckRevealUntil 以外の全 0-pick) で発生。
2. **chain over-fire (B05028) は誤診断**: BUG-111.md「関連未解決」節の B05028 over-fire 主張は再現せず。
   chain の continuation-drop が「そうした場合」gate として **正しく機能** している。
   → B05028 は engine 修正なしで **そのまま出荷可能** (誤って DEFER されていた)。

## 機構 (なぜ起きるか)

- resolver `sequence`/`chain` case は、step が pick await したとき残り step を
  `pending.continuation = {remainder, ctx}` に同梱して一時停止する (BUG-111 #1 修正の 1:1 機構)。
- continuation には **origin (sequence か chain か) が記録されていない**。
- decline 時 (`useEngineDispatch.effectPickResolve` pickedUid=null / `drainAiEffectPicks`):
  - `skipResolvesAtom===true` (deckRevealUntil のみ) → `applyPickSkipAndContinuation` で remainder 実行。
  - それ以外 → **pending 破棄 = continuation も drop**。
- chain では drop が正 (gate)、sequence では drop が誤 (独立 step は常時実行すべき、rules/15)。
  **同一 drop 処理が origin を区別しないのが根本原因**。
- 副次: `applyPickAndContinuation`/`applyPickSkipAndContinuation` は multi-step remainder を
  **常に `{kind:'chain'}` で wrap** する。sequence-origin remainder に chain-gate を誤適用する latent bug
  (中間 step が `__chainStepNoApply` を立てると後続が skip される)。現 3 標的カードには影響しないが要修正。

## 影響カード (決定論 scan、`sequence[0-pick(i<len-1), ...tail]`)

79 ability hit (P/clone 含む、distinct ~49)。高 severity (mandatory tail が silent drop):
- **MVP**: D11014 a2 (sceneEnter→draw)、D08024 a1 (sceneEnter→charModifyAP=benign no-op)
- draw drop: B01040 / B05006 / B05090 / D06017 / PR155 / PR161
- evidenceGain drop: D03002 / PR149
- mill drop: B09106 / その他多数
- 既出荷の B05024 a2 (batch#4)・B08034 a1 等も該当 (head/tail とも 0-pick の独立 step も含む)

AI/CPU 経路・resolve 経路は影響なし (AI は greedy で decline しない)。**human-decline 路のみ** が発火条件 →
BUG-111 記録通り certify/smoke/敵対verify をすり抜けていた。

## 修正方針 (root-cause、最小)

### 1. continuation に origin kind を付与
`PendingEffectPickSide.continuation?: { remainder: Effect[]; ctx: EffectCtx; kind: 'sequence' | 'chain' }`
- resolver `sequence` case → `kind:'sequence'`
- resolver `chain` case → `kind:'chain'`

### 2. remainder wrapping を origin kind で行う
`apply-pick.ts` の wrap を `cont.remainder.length===1 ? cont.remainder[0] : { kind: cont.kind, steps: cont.remainder }`
に変更 (現行ハードコード `'chain'` → origin kind)。`applyPickAndContinuation` (resolve 路) と
`applyPickSkipAndContinuation` (skipResolvesAtom 路) 両方。

### 3. decline routing に sequence-origin 分岐を追加
`applyPickSkipAndContinuation(state, pending, runDeclinedAtom = true)` に `runDeclinedAtom` を追加。
`false` のとき declined head atom を **再実行せず remainder のみ実行** (declined 0-pick = 何もしない、が正しい
意味論。$entered 等の bind は unbound → not-matched で後続 conditional が正しく skip。sceneEnter 単数 path の
`__declined` 未対応による **再 push 問題を回避**)。

`useEngineDispatch.effectPickResolve` (pickedUid===null) と `drainAiEffectPicks` (pickedUid===null) を:
```
if (pending.skipResolvesAtom === true)            applyPickSkipAndContinuation(state, pending);        // 既存 (deckRevealUntil: atom+remainder)
else if (pending.continuation?.kind === 'sequence') applyPickSkipAndContinuation(state, pending, false); // NEW: remainder のみ
else /* chain-origin gate / no continuation */      drop;                                                // 既存
```

### 触る engine ファイル (4)
- `resolve-picks.ts` (continuation 型に kind 追加)
- `resolver.ts` (sequence/chain で kind 付与)
- `apply-pick.ts` (wrap by kind + applyPickSkipAndContinuation の runDeclinedAtom 分岐 + drainAiEffectPicks routing)
- `useEngineDispatch.ts` (human decline routing)

**atom-handlers.ts は触らない** (runDeclinedAtom=false で declined atom を実行しないため __declined 配線不要)。

## opus 敵対設計レビュー反映 (2026-06-16、3 lens)
- **Lens 2 (B05028 誤診断検証) = APPROVE**: 5 シナリオ独立再構築で「chain over-fire は誤診断、B05028 は engine 修正なしで出荷可能」確認。
- **Lens 1 (回帰) = approve-with-changes**: 方針妥当・blast radius 狭い・runDeclinedAtom=false 必然性確認。
- **Lens 0 (意味論) = REJECT (BLOCKER)**: **B09056 の必須末尾が `choice[A,B]`。continuation は `runEffect`(=resolver.run) で実行され、
  resolver の `case 'choice'` は `ctx.dyn.choiceIndex` 既定0 で option0 を即実行し human choice modal を surface しない**
  (human surface は resolve-picks.ts:752 の humanChooser 経路のみ)。→ **B09056 は本修正では green 不可**。

### 反映した scope 調整
1. **解禁は B05028 (修正不要) + B09038 (修正で解禁) のみ。B09056 は DEFER 継続** (choice-in-continuation surface gap = 別 engine 課題、resolve 路にも及ぶ pre-existing 制約)。
2. **「resolve 路 byte 不変」主張を撤回**: by-kind wrap は sequence-origin の multi-step remainder (≥2) を resolve 路でも chain→sequence に変える。
   実差が出るのは B07090/B07090P のみ (Lens 1 が bind 依存で等価と確認)。full vitest + 該当カード test 再走で検証する (latent-fix・正方向)。
3. **責務分離**: `skipResolvesAtom` = atom 再実行が必要な 0枚解決 (deckRevealUntil のデッキ下移動)。`sequence-origin` = atom 不要・remainder のみ。

## 不変条件 (TDD で固定)
- chain[0-pick, X] decline → X 不発火 (B05028: 既に GREEN、回帰させない)
- sequence[0-pick, mandatory] decline → mandatory 発火 (B09038/repro: RED→GREEN)
- sequence[0-pick, choice[A,B]] decline → choice は **surface しない** (既知 gap、repro で明示固定。B09056 DEFER 根拠)
- resolve 路・AI 路は **挙動等価** (full vitest 2535 + B07090/D11014 等該当カード test で確認、byte 不変ではない)
- deckRevealUntil (skipResolvesAtom) は挙動不変 (B03031/B08024 gate5)

## エッジケース
- nested: optional[chain[mandatory, sequence[0-pick, tail]]] (B09038) — inner sequence が最後の chain step なら
  continuation は inner sequence origin で正しく付与される。
- 多段 remainder: sequence wrapping で各 step が独立実行 (chain-gate を誤適用しない)。
- head が deckRevealUntil の sequence: skipResolvesAtom 分岐が優先 (atom 実行 + remainder)。
- 既知 out-of-scope: `chain[A, sequence[0-pick, B], C]` の様な「sequence-in-chain で後続 chain step がある」
  ネストは continuation 上書きの pre-existing 別問題 (現カタログに該当なし、本修正の対象外)。
