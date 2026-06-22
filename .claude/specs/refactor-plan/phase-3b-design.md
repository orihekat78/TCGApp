# Phase 3b 設計: pick-resolution 責務 3 分割 (walk / pending / continuation)

挙動完全不変。`src/engine/effect/resolve-picks.ts` (849 行) が **walk** (effect tree を歩いて `$pick`
置換) と **pending管理** (中断 decision の side-channel 状態) を 1 ファイルに混載している。pending を
新 `pending-state.ts` へ抽出し、resolve-picks を pure walk 化する。continuation (resume) は既存
`apply-pick.ts` が既に担う。**3a と同じ barrel 再export で外部 API を不変に保つ** (importer 改変 0)。

## 不変条件 (byte-identical)

- 移送する pending ブロックは **文字通り無改変** (function body の md5 が HEAD と EOL 正規化後一致)。
- walk 関数 (substituteAtomPick / resolveEffectPicks / tryRePickFromAtom / resolveDynArgs /
  resolveFilterDynObj / resolveTargetFilterDyn) の body も無改変 (行 slice のみ、本文不変)。
- 唯一の差分: ① private fn 7 個に `export` 付与 (additive) ② resolve-picks に import 行 + 再export 行を追加。
- safety net: tsc (noUnusedLocals/noUnusedParameters) + full vitest baseline + smoke:1000 一致 + e2e 回帰0 + eslint delta0 + 規約 lint。

## 現状の責務混在

| ファイル | 行 | 責務 |
|---|---|---|
| resolve-picks.ts | 849 | **walk** (L1-165, L468-849) + **pending管理** (L166-467 連続ブロック) |
| apply-pick.ts | 457 | **continuation** (resume + AI drain)。logic 不変 |
| resolver.ts | 177 | 汎用 effect interpreter (`run`) + attachContinuation。不変 |
| atom-pick-spec.ts | 93 | 短縮形 spec (leaf)。不変 |

## 目標構成

```text
src/engine/effect/
  resolve-picks.ts   walk: dyn helpers + substituteAtomPick + resolveEffectPicks + tryRePickFromAtom
                     + 旧 public pending API を pending-state から再export (barrel)
  pending-state.ts   NEW: declare global ×8 + Pending*Side 3型 + ContinuationFrame型 + toPlainDeep
                     + queue/choice/optional の getter/setter/drain/peek/clear/take 全部
  apply-pick.ts      continuation (不変。import は resolve-picks 再export 経由のまま)
  resolver.ts        不変 (ContinuationFrame 型は resolve-picks 再export 経由のまま)
```

## 移送ブロック (決定論: 行 slice)

- **L166–467** (302 行、連続) を pending-state.ts へ verbatim 移送。前後は walk-type(L165 終) / walk-fn(L468 始)。
- 内訳: declare global / ContinuationFrame・PendingEffectPickSide・PendingEffectChoiceSide・
  PendingEffectOptionalSide 型 / pick queue 9fn / choice 10fn / optional 8fn / toPlainDeep。
- pending-state は ../types から **`Effect`/`EffectCtx` のみ** import (block の型使用 = Effect×19/EffectCtx×1)。
  **GameState/Candidate は不使用** (noUnusedLocals が GameState 余剰 import を即弾く)。
- 移送 block は local 型 `type Player='self'|'opp'` を 4 箇所参照する。この定義 (L28) は walk 側に残るため、
  pending-state.ts 先頭に **`type Player='self'|'opp'` を複製** する (apply-pick.ts / atom-handlers/_shared.ts が
  既に per-file 複製している確立パターン。構造的型で walk 側と相互運用可、byte-identical 不変)。

## import / 再export 配線

- **walk が pending-state から import** (9): pushPendingEffectPickSide* / toPlainDeep /
  _peekPendingEffectChoiceSide / getPendingChoiceResume* / setPendingChoiceResume* /
  pushPendingEffectChoiceSide* / setPendingChoiceBindings* / pushPendingEffectOptionalSide* /
  setPendingOptionalResume*。`*` = 現 private → pending-state で `export` 付与する 7 個
  (getPendingQueue / syncLegacyPickProperty は pending-state 内 private 維持)。
- **resolve-picks が再export** (旧 public pending 全部、explicit list で surface 同一):
  type ContinuationFrame / PendingEffectPickSide / PendingEffectChoiceSide / PendingEffectOptionalSide,
  value _pushPendingEffectPickSideForTest / pushPendingPickFromAtom / toPlainDeep /
  _drainPendingEffectPickSide / _peekPendingEffectPickQueueLength / _clearPendingEffectPickQueue /
  _drainPendingEffectChoiceSide / _clearPendingEffectChoiceSide / _takePendingChoiceBindings /
  _peekPendingEffectChoiceSide / _takePendingChoiceResume / _clearPendingChoiceResume /
  _drainPendingEffectOptionalSide / _clearPendingEffectOptionalSide / _peekPendingEffectOptionalSide /
  _takePendingOptionalResume / _clearPendingOptionalResume。
- walk native export (移動なし): resolveEffectPicks / tryRePickFromAtom / ChooseAtomTargetFn / ResolveEffectPicksOpts。

## 外部 API 不変 (importer 改変 0)

| importer | 取得 symbol | 解決先 |
|---|---|---|
| useEngineDispatch.ts | _drainPending*Side ×3 | resolve-picks 再export |
| atom-handlers/{picks,scene,...}.ts | tryRePickFromAtom / pushPendingPickFromAtom / toPlainDeep | native / 再export |
| heuristic/policy/triggered/declared-ability | resolveEffectPicks | native |
| apply-pick.ts | Pending*型 / ContinuationFrame / resolveEffectPicks / _take* ×3 | 再export / native |
| resolver.ts | ContinuationFrame 型 | 再export |
| tests ~50+ files | 同上 | 再export / native — 全て変更不要 |

## エッジ / 罠

- **attachContinuation は resolver.ts に存置** (apply-pick ⇄ resolver 循環回避: apply-pick は resolver の
  `run` を import 済。attachContinuation を apply-pick に移すと resolver→apply-pick の逆 import で循環)。
- `declare global` は ambient → pending-state の 1 ファイル宣言で project 全域有効 (resolve-picks の inline
  `(globalThis as {...})` cast は declare 非依存、移送後も無傷)。重複 declare なし (tsc が検知)。
- 循環なし: pending-state(leaf) ← resolve-picks ← {apply-pick, resolver}。pending-state は walk を import しない。
- side-channel global の直接 consumer = apply-pick.ts / resolver.ts / **resolve/stack.ts** / ai/policy.ts (全て
  inline `globalThis as {…}` cast、declare 非依存 → 移送無影響)。Phase 3c (8→5 縮減) の consumer 集合として記録。
- EOL: autocrlf で working tree=CRLF。slice script は EOL 自動判別 + md5 は正規化後比較 (skill 罠表)。
- tsc は src のみ → test importer の再export 取りこぼしは **full vitest が唯一 gate** (必須)。

## 検証 / codemod method

- node script で HEAD resolve-picks を 3 slice (1-165 / 166-467 / 468-849)。pending-state= header (`Effect`/`EffectCtx`
  import + local `Player` 複製) + block。export 付与は **named-7 whitelist** (`function NAME(`→`export function NAME(`、
  pushPendingEffectPickSide/pushPendingEffectChoiceSide/setPendingChoiceBindings/setPendingChoiceResume/
  getPendingChoiceResume/pushPendingEffectOptionalSide/setPendingOptionalResume のみ。getPendingQueue/
  syncLegacyPickProperty は **private 維持** = blanket 置換しない)。resolve-picks= part1 + import/再export + part2。
- 再export の型 (ContinuationFrame/PendingEffectPickSide/ChoiceSide/OptionalSide) は **別 `export type {…} from` 文**
  (isolatedModules:true、3a barrel と同 idiom)。overlap symbol (toPlainDeep / _peekPendingEffectChoiceSide) は
  walk 内部 import **かつ** 再export の両方が必要 — `import {…}` と `export {…} from` を併記 (ESM 合法)。
- 自己検証: 移送 block byte-equal (export-7 prefix 付与後) + walk part1/part2 byte-equal を md5 で reconstruct 比較。
  加えて tsc が Player 欠落 (TS2304) / GameState 過剰 (noUnusedLocals) を即検知 → 設計どおり実装の最終 gate。
- 回帰テスト棚卸し: [phase-3b-test-inventory.md](phase-3b-test-inventory.md) (BUG-054〜121 を 3 group 化)。
