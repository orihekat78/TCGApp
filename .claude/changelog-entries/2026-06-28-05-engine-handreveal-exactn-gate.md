# engine — additive: handReveal exact-N gate (2026-06-28)

**Round/Phase**: 2026-06-28 engine additive。`handReveal` atom (2026-06-28 出荷) の
**exact-N over-fire** を塞ぐ additive gate。短縮形 `n:N` (=「N枚公開する」固定数、rules/15
「N枚」=「まで」なし=all-or-nothing) のとき、手札の filter 一致候補が N 枚未満なら公開不可と判定し
`chainStepNoApply` で「そうした場合」の後続を gate する。全変更 additive (handReveal を使うカードは
現状ゼロ → 回帰0、smoke winsA=498 不変)。spec: `.claude/specs/engine-additive-handreveal-design.md`。

## バグ (over-fire)

B09061 ジェイムズ・ブラック a1「手札から〚特徴［FBI］〛のキャラを **3枚**公開してもよい。
そうした場合、カードを1枚引く」を probe したところ、手札の FBI が 3枚未満 (例 2枚) でも
後続 draw が発火していた。短縮形 `n:3` (pick {min:3,max:3}) は候補<3 のとき all-or-nothing で
gate されず、available 全部を公開して count>0 → 後続を実行していた (既存 gate は resolved 0枚のみ)。

## 修正

`atomHandReveal` の短縮形 entry に exact-N gate を追加:

- `a.target===undefined && typeof a.n==='number'` (= 短縮形 exact-N) のとき
  `candidates(builtPick).length < a.n` なら `chainStepNoApply` + log `gate-skip` + return (pick を enqueue しない)。
- `max:N` (`a.n` 不在、pick.min=0「N枚まで」) は 0..N 可ゆえ **gate しない** (従来の resolved gate-on-0 のみ)。
- 判定は **短縮形 entry の候補数** で行う: drain 経路 (apply-pick generic Pattern B) は resolved target を
  単一に collapse するため resolved length では「<N」を検出できない。reveal は zone 不変ゆえ availability
  さえ満たせば後段の単一 collapse でも mechanical に等価 (bind が load-bearing なのは n:1 のみ)。

## 「してもよい」optionality との整合

- **公開不可** (候補<N): 新 gate が後続を skip。
- **辞退** (候補≥N だが skip): 既存の chain-origin decline (`applyPickSkipAndContinuation` runDeclinedAtom=false)
  が remainder を skip。エンジン経路は揃う (skip UI affordance は companion defer)。
- **公開成立** (候補≥N で N 枚 pick): 後続 draw 実行。

## 解禁

**B09061 a1 が engine 変更0 で出荷可能化** (handReveal exact-N + draw + 既存 handAddFromRemove ヒラメキ)。
旧「単独解禁可」誤認 → exact-N gate が真の残 gate だった (DEFERRED-INDEX §handReveal)。

## テスト / ゲート

§10a-d 追加 (over-fire 修正 / happy-path 保持 / entry-gate / max-form 非 gate 回帰)。
tsc 0 / vitest 3269 pass / 8 custom lint errors=0 / smoke:1000 winsA=498・avgTurns=11.00・timeouts=0・exceptions=0 (baseline 一致)。
