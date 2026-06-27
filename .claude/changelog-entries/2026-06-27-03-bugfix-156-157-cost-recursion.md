# engine bugfix — BUG-156 sleepChar over-pay + BUG-157 continuousDelta 相互再帰 (2026-06-27)

**Round/Phase**: 2026-06-27 engine bugfix。骨格凍結原則の **「骨格自体のバグ修正」例外**。
2件とも latent (出荷カード非該当の局面でのみ顕在)。挙動不変ゲートで additive 同等の安全性を担保。
spec: `.claude/specs/engine-bugfix-156-157-cost-recursion.md`。

## BUG-156 — sleepChar コスト over-pay

`cost/pay.ts` の `sleepChar` は `ctx.picked ?? cands` を**全件** sleep していた。`ctx.picked` は cost 経路で
production 未配線 (調査: UI/AI が surface する cost picker は `flipFaceUpEvidence` のみ、`ctx.picked` は
全 cost で dead) → `cost.target.n.max` を honor せず 2+ active 候補で**全 sleep** (rules/15「1枚」違反)。
→ `stunChar` と**完全同形**に是正 (n.max cap + active gate + head-fixed)。「どの active を選ぶか」の
player-choice 欠如は全 target-pick cost 共通の pre-existing 制約 (別 initiative、out of scope)。

## BUG-157 — read.char.ap/lp/level の continuousDelta 無 guard 相互再帰

`read/char.ts` の `ap`/`lp`/`level` は local `continuousDelta` を直呼びしていた (再入 guard
`_inContinuousDelta` は candidates.ts の `continuousDeltaSafe` のみが set/clear)。`cond/eval.ts` の
`apAtLeast`/`lpAtLeast`/`compareAP` も `charRead.ap/lp` 委譲 → continuous apDelta(gated lpAtLeast)⇄
lpDelta(gated apAtLeast) 等で無限相互再帰 (stack overflow)。
→ `continuousDeltaSafe` を export し ap/lp/level を guard 経由に統一 (3軸対称)。再入時 base 0 で depth-2 終端
(matchOneFilter と同 posture = BUG-113)。**出荷カードに「numeric-delta ability + ap/lp 読み condition」は
皆無**ゆえ guard 不発火 = 全出荷カード値不変 (B09008 は grantKeywords+apAtLeast で numeric delta ではない)。

## 検証

- TDD (RED→GREEN)。新 test 2本 10 pass: `engine-cost-sleepchar-bug156-2026-06-27` (§6 over-pay cap が RED→GREEN) /
  `bug-157-continuous-delta-recursion-guard` (§1 相互循環・§2 自己循環が stack overflow→no-throw、§3 非循環回帰)。
- gate: tsc0 / full vitest 3122 pass 1 skip / smoke:1000 winsA=498 timeouts0 exceptions0 (baseline 完全一致) /
  8 custom lint + 自ファイル eslint 0。
- **opus 4-lens 敵対 review** (invariance/completeness/bug156-correctness/test-adequacy)。
