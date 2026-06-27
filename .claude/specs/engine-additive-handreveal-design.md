# engine additive: handReveal atom + revealFromHand cost 設計 (session63+)

「手札から filter 一致カードを1枚公開する」を engine に additive 追加する。
公開は **zone 変化なし** (公式Q&A B08082/B08093: 効果/コスト解決後に手札へ戻してよい)。
colorNot (session60) / caseColorNot (session62) と同じ **engine-only 出荷** 方針
(カードは companion 揃い次第、後 session)。挙動不変 (既存カードは未使用)。

## 解禁対象 (将来カード、本 session では出荷しない)

| card | 句 | 必要 = handReveal + companion |
|------|----|------|
| B08082 a1 | 「手札から【現場リムーブ時】を持つキャラを1枚公開してもよい。そうした場合 突撃」 | atom + ability-presence filter (未) |
| B07022 | 「手札から特徴[高校生]を1枚公開してもよい。そうした場合 突撃。公開が【緑】以外なら AP+1000」 | atom + $revealed 色読み condition (未) |
| B08093 a1 | 「〚手札から【現場リムーブ時】を持つ【青】か【黒】を1枚公開する〛: Lv9以下1枚リムーブ」 | cost + ability-presence filter (未) |

→ handReveal 単独では出荷不可。companion (ability-presence filter / $revealed 色読み) は別 follow-up wave に defer。

## 命名 (既存規約準拠)

- effect atom verb = **`handReveal`** (`handAddFromRemove`/`handAddFromDeck`/`handToEvidence` の hand-prefix 系)
- cost kind = **`revealFromHand`** (`removeFromHand`/`removeFromScene` の verb-FromZone 系)

## 1. handReveal atom

`atomDiscard` の clone から `mutate.hand.discardToRemove` を **除去** したもの (= 唯一の差):

- 短縮形 args: `{ player:'self', max:N, filter }` (discard と同一 — `buildShortFormPick`/`tryRePickFromAtom`/
  `ATOM_PICK_SPEC.handReveal.defaultArea='hand'` で pick infra をそのまま継承、UI/AI pick が free)
- target 未解決 (string[] でない) → `tryRePickFromAtom` で awaiting-pick enqueue + log `effect:handReveal:awaiting-pick` (discard と同型)
- target 解決後:
  - **zone 変化なし** (mutate 呼ばない、カードは手札に残る)
  - `a.bind` が string なら revealed cardId 群を `ctx.bindings[a.bind]` に格納 ($revealed 色読み companion の足場)
  - **`target.length === 0` → `(ctx.dyn ??= {}).chainStepNoApply = true`** ← 「公開してもよい。そうした場合〜」を gate
    (mill の `gate` と同型。reveal は他効果ゼロゆえ **無条件 gate-on-0**、opt-in flag は付けない = YAGNI)
  - log `effect:handReveal` result=String(count)

## 2. revealFromHand cost

`removeFromHand` と同型だが `pay()` が **no-op**:

- 型: `{ kind:'revealFromHand'; target: TargetingRef; n: number }`
- `canPay`: `candidates(state, cost.target, ctx).length >= cost.n` (removeFromHand と同一)
- `pay`: 状態変化なし。`acc.paidItems.push({ kind:'revealFromHand', details:{ ids } })` のみ (ids は presence 確認、カードは手札に残る)
- `costToText`: `手札から ${cost.n} 枚を公開`

## 3. Honor sites (tsc exhaustive + sync test が漏れを compile/test で強制)

| handReveal atom | revealFromHand cost |
|---|---|
| `types/effect.ts` AtomVerb union | `types/effect.ts` Cost union |
| `effect/atom-handlers/core.ts` 新 `atomHandReveal` | `cost/evaluate.ts` COST_KIND_MAP + canPay case |
| `effect/atom-handlers.ts` import + dispatch case (never guard 強制) | `cost/pay.ts` payInner case (never guard 強制) |
| `effect/validate.ts` ATOM_VERBS set (sync test 強制) | `ui/hooks/useActionsPanelFlow/cost.ts` costToText (never guard 強制) |
| `scripts/taskA-validate-specs.cjs` VERBS set (sync test 強制) | `scripts/taskA-validate-specs.cjs` COSTS set (sync test 強制) |
| (`ATOM_PICK_SPEC` に handReveal の defaultArea='hand') | |

## 4. エッジケース

- 手札0枚 / filter 不一致0枚 → atom: target.length=0 → chainStepNoApply (後続 skip) / cost: canPay=false (宣言不可)
- max>1 で複数該当 → 該当全 reveal (zone不変)。count>0 ゆえ chain 継続
- chain 非内包 (handReveal が末尾/単独) → chainStepNoApply セットされても後続 step 無し = 無害
- revealFromHand cost で n 枚未満 → canPay=false (rules/21 「全部行えなければ使用不可」)
- pay 後カード手札残存 → 同 cost を再宣言可能 (presence-check、消費なし)。【ターン1】等の回数制限は ability 側 gate が担う

## 5. 挙動不変ゲート

tsc0 / vitest baseline (HEAD 件数) / smoke:1000 winsA=498 (既存カード未使用 = 機械保証) /
専用 test (atom 3 path + cost canPay/pay no-op) / 8lint / 既存カード grep 0 hit。

## 6. 明示 defer (companion、別 wave)

- ability-presence filter (TargetFilter「【現場リムーブ時】を持つ」) → B08082/B08093 解禁待ち
- $revealed 色読み condition (「公開キャラが【緑】以外の色を持つ」) → B07022 解禁待ち
- handReveal/revealFromHand UI awaiting-pick label + AI heuristic → カード出荷時に実機検証 (removeSetCard UI picker と同じ非ブロッカー defer)
