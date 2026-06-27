# Engine bugfix: BUG-156 (sleepChar over-pay) + BUG-157 (continuousDelta 相互再帰) unified

> spec for session 2026-06-27。骨格凍結原則の例外「骨格自体のバグ修正」(CLAUDE.md)。
> 2件とも latent (出荷カード非該当の局面でのみ顕在)。挙動不変ゲートで additive 同等の安全性。

## BUG-156 — sleepChar コスト over-pay

### 症状
`cost/pay.ts` の `sleepChar` case は `targets = ctx.picked ?? cands` を**全件** sleep。
`ctx.picked` は cost 経路で production 一度も配線されない (調査: UI/AI で picker surface
されるのは `flipFaceUpEvidence` のみ、`ctx.picked` は全 cost で dead) ため `cands` =
candidates(target) の全一致を sleep。`n.max` を honor せず、2+ active 候補で**全 sleep** (rules/15「1枚」違反)。

### 修正 (ユーザー選択 (a): stunChar parity、head-fixed)
`sleepChar` pay を `stunChar` (pay.ts:61-77) と**完全同形**にする:
- `maxN = ctx.picked ? Infinity : (cost.target.kind==='pick' ? cost.target.n.max : Infinity)`
- active gate (`c.state==='active'`) — canPay が ≥1 active を要求 (evaluate.ts:38-47) ゆえ
  pay 時に active 保証。非 active cand は元々 setState(sleep) が no-op (sleep=同状態 / stun=rules/03
  でスタン維持) → skip しても挙動不変。
- head-fixed first-n (player-choice は付けない)。

### なぜ (b) 真 pick channel ではないか
全 target-pick cost (sceneToDeckBottom/removeAreaToDeckBottom/removeSetCard) が head-fixed
fallback 運用 (costParams reader は在るが flows.ts で未 populate)。sleepChar/stunChar だけ真
picker を新設すると唯一の例外 + 大規模 UI 新設 (現状 cost picker は flip のみ)。**「どの該当
キャラを選ぶか」の player-choice 欠如は全 cost 共通の pre-existing 制約**で sleepChar 固有でない。
全 cost 横断の picker 化は別 initiative (out of scope)。

### 影響カード (14枚、全て n:{1,1})
cardName filter: B04070/B05074/B09082。trait: B03060/B05059/B07066/B09058。
level/color: B07016/B07067。excludeSelf only: D01003/B01063。
→ いずれも 2+ active 一致が現場に並んだ時のみ over-pay。head-fixed cap で 1 枚に是正。

## BUG-157 — read.char.ap/lp/level continuousDelta 無 guard 相互再帰

### 症状
`read/char.ts` の `ap`/`lp`/`level` は local `continuousDelta` (read/char.ts:36) を**直接**呼ぶ。
再入 guard `_inContinuousDelta` は candidates.ts の `continuousDeltaSafe` のみが set/clear し、
matchOneFilter 経路にしか掛からない。`cond/eval.ts` の `apAtLeast`/`lpAtLeast`/`compareAP` は
`charRead.ap/lp` 直呼び (= 無 guard entry)。
→ continuous apDelta(gated by lpAtLeast) ⇄ lpDelta(gated by apAtLeast) で無限相互再帰 → stack overflow。
自己循環 (apDelta gated by apAtLeast→$self) でも overflow。

### 修正
`candidates.ts`: `continuousDeltaSafe` を `export`。
`read/char.ts`: `ap`/`lp`/`level` の `continuousDelta(...)` 呼び出しを `continuousDeltaSafe(...)` 経由に
(import 追加)。3軸対称。`cond/eval` AtLeast は charRead.ap/lp 委譲ゆえ自動継承 (cond/eval 無改変)。
再入時は base 値で 0 を返し depth-2 で終端 (matchOneFilter 経路と同 posture = BUG-113)。

### 挙動不変性 (証明)
continuousDelta は `continuousModifier[apDelta/lpDelta/lvlDelta]` を持つ ability のみ
evalCond する (read/char.ts:50-52)。**出荷カードに「numeric-delta ability + ap/lp 読み condition」は
皆無** (全カード grep: 一致は _reuse/index.ts のコメント行のみ、B09008 は grantKeywords[突撃]+apAtLeast
= numeric delta ではない)。よって continuousDelta の evalCond は ap/lp を読まず、guard は全出荷カードで
不発火 → 値不変。sceneHas+apMin 系条件は既に guarded matchOneFilter 経由で安全。

## 挙動不変ゲート
- tsc 0
- 新 RED→GREEN テスト (sleepChar over-pay cap §6 相当 / continuousDelta 相互+自己循環 no-throw + 値検証 / 非循環回帰)
- full vitest 全 pass (baseline は本 HEAD で確認)
- smoke:1000 + check:smoke-baseline (winsA=498 期待、avgTurns delta/timeouts/exceptions が check 対象)
- 8 custom lint + eslint 0

## 関連
- bugs/BUG-156.md, bugs/BUG-157.md
- cost/pay.ts (sleepChar/stunChar), read/char.ts (ap/lp/level/continuousDelta), target/candidates.ts (continuousDeltaSafe guard), cond/eval.ts (apAtLeast/lpAtLeast/compareAP)
