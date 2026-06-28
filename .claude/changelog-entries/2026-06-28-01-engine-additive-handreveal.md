# engine — additive wave: handReveal atom + revealFromHand cost (2026-06-28)

**Round/Phase**: 2026-06-28 engine additive wave。骨格凍結原則の **additive 例外** で
「手札から filter 一致カードを公開する」(zone 変化なし) を effect atom と宣言コストの両形で追加。
colorNot(session60)/caseColorNot(session62) と同じ **engine-only 出荷** (カードは companion 揃い次第 後 session)。
全変更 additive (既存カードは新 verb/cost 未使用 → 回帰0、smoke winsA=498 不変)。
spec: `.claude/specs/engine-additive-handreveal-design.md`。

## 新 effect atom `handReveal`

- 「手札から filter 一致を1枚公開してもよい。そうした場合〜」(B08082 a1 / B07022)。
- `atomDiscard` の clone から `mutate.hand.discardToRemove` を除去 = **zone 変化なし** (公式Q&A B08082:
  「効果を解決した時点で元に戻してかまいません」)。短縮形 `{player,max,filter}` は discard と同一 pick path。
- **0枚 reveal → `chainStepNoApply`** で「そうした場合」を gate (mill gate と同型、reveal は他効果ゼロゆえ無条件 gate-on-0)。
- `bind` で公開 cardId を `ctx.bindings` に格納 (`{cardId}[]` 形、$revealed 色読み companion の足場)。

## 新 cost kind `revealFromHand`

- 〚手札から filter 一致を n 枚公開する〛宣言コスト (B08093 a1)。
- `removeFromHand` と同型 canPay (`candidates ≥ n`) だが `pay()` は **no-op** = presence-check cost
  (公開のみ、消費なし)。公式Q&A B08093:「コスト支払い完了→効果解決に入る時点で元に戻してかまいません」。
- 再宣言可能 (消費されない)。回数制限は ability 側 gate の責務 (rules/21)。

## honor site (atom 5 + cost 5)

- atom: `types/effect.ts` AtomVerb / `atom-handlers/core.ts` atomHandReveal / `atom-handlers.ts` dispatch (never guard) /
  `effect/validate.ts` ATOM_VERB_MAP (satisfies) / `atom-pick-spec.ts` (defaultArea 'hand') / `taskA-validate-specs.cjs` VERBS (sync test)。
- cost: `types/effect.ts` Cost / `cost/evaluate.ts` COST_KIND_MAP + canPay / `cost/pay.ts` payInner (never guard) /
  `ui/.../cost.ts` costToText (never guard) / `taskA-validate-specs.cjs` COSTS (sync test)。

## 検証

- TDD (RED→GREEN)。新 test `tests/engine/effect/atom-hand-reveal.test.ts` (9) + `tests/engine/cost-reveal-from-hand.test.ts` (11) = 20 pass。
  atom: zone不変/bind/gate-on-0 (resolved+短縮形0候補2経路) / chain gate / **bind downstream = boundMatchesFilter $revealed (B07022第2句ミニ再現、fire+skip)** / max>1 / 短縮形→AI drain→continuation 統合。
  cost: canPay gating / pay no-op (hand不変・再宣言可) / pay-nest / n=2 multi + paidItems / trait filter。
- gate: tsc0 / full vitest **3199 pass 0 fail** (sync-taskA 含む) / smoke:1000 **winsA=498 ex=0 baseline 完全一致** / 8 custom lint errors=0 / 既存カード grep 0 hit。
- **opus 4-lens 敵対 review = 全 ship:true / blocker 0** (semantic-equivalence/additivity-invariance/dsl-traps/edge-test-adequacy)。
  反映した concern: ①doc「唯一の差」→「2点差 (discardToRemove除去 + gate-on-0)」訂正 ②bind downstream 統合テスト追加 (最重要) ③max>1 + paidItems + trait filter + continuation テスト追加。

## companion defer (別 follow-up wave、DEFERRED-INDEX §handReveal)

- ability-presence filter (「【現場リムーブ時】を持つ」) → B08082/B08093 解禁待ち。
- $revealed 色読み condition (「公開が【緑】以外」) → B07022 解禁待ち。
- handReveal/revealFromHand UI awaiting-pick label + AI heuristic → カード出荷 session で Playwright 実機検証 (removeSetCard UI picker と同じ非ブロッカー defer)。
- B09061 は handReveal atom 単独で解禁可。
