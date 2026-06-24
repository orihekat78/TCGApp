# Engine additive wave (2026-06-24)

骨格凍結原則の **additive 例外** 運用。wave event-choose3 由来 DEFER (DEFERRED-INDEX §559-569) の
engine gate を解禁する。各 gap = 独立 commit、各 gate (tsc0 / vitest baseline / smoke winsA=498) green。
全変更が **additive** (既存カードは新 field/cost を未宣言 → 挙動不変・回帰0)。

> 本 session は **engine + fixture exemplar test のみ**。実カード (B08050/B08059/B08004/B08023…) は
> 並行 card-session が新 field/cost で出荷する (engine/card 分離・衝突回避)。errata 反映も card 側。

## Gap 2 (carrier-reuse) — reframe: engine 不要 (stale DEFER)

DEFERRED-INDEX §567「carrier-reuse exemplar 0件 / 未証明」は **誤り**。`bind:'$picked'` +
`uid:'$picked.uid'` 機構は 2026-06-12 出荷済 (BUG-130 修正 / Task D E0)。

- engine test: [pick-bind.test.ts](../../tests/engine/effect/pick-bind.test.ts)
- 出荷 exemplar: [B02040.ts](../../src/cards/ct-p02/B02040.ts) a2 = `choice → sequence`[`charSetCard{uid:'$pick', bind:'$picked', target: ≤1 pick}`, `charModifyAP{uid:'$picked.uid'}`] — B08023 と同一 shape

→ **engine 変更 0**。本 wave は DEFERRED-INDEX を訂正し B08023 を card-session の green候補に解放。
⚠ B08033 a2 は別 gate (set-card-removal COST kind, §286) 併発で依然 DEFER。

## Gap 1 — `ContinuousModifier.lvlDelta` (additive engine)

「【自分ターン中】レベル+1」「【解決編】レベル+3」型の条件付き継続レベル修正。`apDelta`/`lpDelta`
と完全対称に `lvlDelta?: ContinuousDelta` を1 field 追加。

honor site は2つだけ (BUG-117 原則: filter-level == combat-level):

| site | 変更 |
|------|------|
| [read/char.ts:148](../../src/engine/read/char.ts#L148) `level()` | `+ continuousDelta(s,uid,'lvlDelta')` (`which` union 拡張) |
| [candidates.ts:328](../../src/engine/target/candidates.ts#L328) matchOneFilter | `+ continuousDeltaSafe(state,c?.uid,'lvlDelta')` |

- **再帰**: module-level `_inContinuousDelta` guard ([candidates.ts:28](../../src/engine/target/candidates.ts#L28)) は
  which 非依存で全再入を遮断 → B08059 の自己参照条件でも無限ループ無し
- **out of scope (明示)**: 静的 `d.level` filter site = [cond/eval.ts:296](../../src/engine/cond/eval.ts#L296) /
  [_shared.ts:96](../../src/engine/effect/atom-handlers/_shared.ts#L96)。既存 `turnEffects.lvlMod` すら
  honor していない pre-existing 不整合で、本変更が導入する物ではない。target card は self-buff を
  *他者の targeting filter* (=candidates 経路) で消費するため不要
- `lvlDeltaAura` は **作らない** (B08059/B08050 とも self-only、YAGNI)
- play-level (`hand-use-card` / `next-hint` の `d.level`) は **静的のまま** 維持
  (B08050 QA「現場以外はレベル4のまま」と一致)

exemplar: fixture char に `lvlDelta` 宣言 → `read.char.level` と candidates filter 両方が反映 +
play-level は静的のまま を pin する behavioral test。

## Gap 3 — Cost `stunChar` (additive engine)

宣言コスト〚アクティブ状態の[X]を1枚スタンさせる〛(B08004)。`sleepChar` と対称に新 Cost kind。

| site | 変更 |
|------|------|
| [effect.ts:227](../../src/engine/types/effect.ts#L227) Cost union | `\| { kind:'stunChar'; target: TargetingRef }` |
| [cost/evaluate.ts:14](../../src/engine/cost/evaluate.ts#L14) | `COST_KIND_MAP.stunChar=true` + `canPay` case (候補に active が存在、sleepChar と同形) |
| [cost/pay.ts:43](../../src/engine/cost/pay.ts#L43) `payInner` | case → `mutate.scene.setState(uid,'stun')` + paidItems |
| `scripts/taskA-validate-specs.cjs` COSTS | whitelist へ `stunChar` 追記 (sync test 強制) |
| AI [move-enumerator.ts:156](../../src/ai/move-enumerator.ts#L156) | `cost.canPay` で generic gate 済 → 追加配線不要 |

- stun 特殊挙動 ([scene.ts:382](../../src/engine/mutate/scene.ts#L382)): active→stun は素直に stun 化、
  既 stun は不変。canPay は `state==='active'` 要求 (コスト文「アクティブ状態の」、sleepChar と同要件)

exemplar: fixture declared ability (cost=stunChar) で canPay gate + pay で対象が stun 化する behavioral test。

## エッジケース

- 手札0/デッキ0: lvlDelta は on-scene continuous のみ → 非現場では無効 (play-level 静的)。stunChar cost で候補0 → canPay=false
- 不可逆: stunChar は cost (支払済みなら能力解決)。スタン解除は別効果
- 状態相互作用: stunChar 対象が既 stun → setState 不変 (rules/03 スタン特殊挙動)
- 数値: lvlDelta で level<0 もあり得る (rules/19 下限なし) → リムーブ等は起きない
- 複合/連鎖: lvlDelta 条件 (【自分ターン中】等) 失効で即 0 化 (rules/24 常時有効型) — turnEffect と異なり清掃不要

## 進め方

1. Gap1 lvlDelta → TDD (fixture test 先) → gate → 敵対 review → commit → FF push
2. Gap3 stunChar → 同上 → commit → FF push
3. Gap2 doc: DEFERRED-INDEX 訂正 + 本 spec link → commit → FF push

各 commit を現 HEAD から branch、`git add <files>` 明示 (NOT -A)、`git diff --cached` で混入確認、
pre-commit の docs:check が並行 card WIP で drift する場合は 8 lints 手動 green + `--no-verify`。
