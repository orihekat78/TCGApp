# 作業ログ — 名探偵コナンTCG プロジェクト

## セッション 2026-05-23 PM (BUG-077 修正)

### 結果

- BUG-077 修正完了 (commit `a5a22b7`)
- BUG-078 起票 (step 2 解決後 step 3 modal 未表示、本 commit verify 中に発覚)
- vitest 1575 PASS / 1 skipped
- typecheck clean
- smoke 1000 戦 timeouts=0 exceptions=0 winsA=511 winsB=489

### BUG-077 真の root cause (Playwright trace で特定)

`triggered.ts → resolveEffectPicks(humanChooser=true)` の初期 walk で、D08013 a1
sequence の step 3 discard PB が先行して side-channel set:

- step 2 evidenceToHand PB: 初期 walk 時点 evidence empty → cands=0 → set せず
- step 3 discard PB: hand=5 cands → side-channel に discard 内容を set
- runtime drain で step 2 awaiting-pick の tryRePickFromAtom が globalThis set 済で bail
- → UI には step 3 (hand pick) modal が表示、log は step 2 + step 3 双方出る

### 修正内容

`src/engine/effect/resolve-picks.ts`:

- `ResolveEffectPicksOpts._fromAtomHandler?: boolean` 追加 (default false)
- `tryRePickFromAtom` → `substituteAtomPick` 呼出時に `_fromAtomHandler: true`
- `substituteAtomPick` humanChooser 分岐: `if (isPatternB && !opts._fromAtomHandler) return atom`
- → Pattern B side-channel set は runtime tryRePickFromAtom 経由でのみ実行
- → Pattern A は引き続き初期 walk で set (runtime awaiting-pick path 無いため)

### 検証 (Playwright 実機)

- D08013 投入 → step 1 evidenceGain (+D08007 to evidence)
- step 2 modal: 候補に cardId='D08007' (evidence の cardId)、atomVerb='evidenceToHand' ✓
- 選択 → evidence=[]、hand に D08007 追加 ✓

### 後続 BUG-078

step 2 解決後 step 3 (discard) modal が表示されない。
原因: `effectPickResolve` dispatch が resolved step 2 atom を単発 queue する
だけで、sequence の残り step を再 queue する仕組みが無い。
BUG-076 の tryRePickFromAtom 追加は step 2/3 modal chain を意図していたが、
resolved 後の re-queue 部分が未実装。
