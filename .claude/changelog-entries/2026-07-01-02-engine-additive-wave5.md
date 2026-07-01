# engine additive wave-5 (2 pure-additive) — boundAnyMatchesFilter cond / handUseRestrictFilter (case 継続手札使用制限)

**Round/Phase**: 2026-07-01 engine-first フェーズ E1 wave-5 (engine/wave5-bound-handrestrict)。engine-extension-plan-2026-06-30 の
G17 (relative-filter-revealed-color) + P05 (restriction-flags 手札使用禁止) を origin/main (8d76aeb3) 実 grep で genuine-absent 確認後、
純 additive 2 件を **まとめて** 出荷 (wave-2/3/4 方式)。カード自身は別 card phase で出荷 (本 wave は engine 足場 + 専用 unit test のみ、engine-only)。

## engine 拡張: 純 additive 2 件 (新 symbol / optional field = 既存カード未参照 → 挙動不変)

1. **`boundAnyMatchesFilter` cond** (G17) — [cond/eval.ts](../../src/engine/cond/eval.ts) `ctx.bindings[bindKey]` の
   **全枚数のいずれか** が TargetFilter に一致するか。既存 `boundMatchesFilter` は `bound[0]` のみ読むため N>1 の
   公開/リムーブ集合を評価できなかった。各要素を `matchOneFilter`(c=null=CardDef 印字値、remove-area cand は
   removeColorAtLeast L291 と同流儀) に委譲。→ PR132「上から3枚リムーブ…特徴[警察]のキャラがリムーブされた場合…突撃を持つ」(any) /
   D06013「上から4枚公開…【緑】と【白】が1枚以上」= `and[boundAny{color:緑}, boundAny{color:白}]` で合成。
   ※ B07002「色の異なる特徴[探偵]を2枚リムーブした場合」(distinct-color pair) は別 Condition が要るため **本 wave 対象外 (DEFER)**。
2. **`handUseRestrictFilter` ContinuousModifier field** (P05) — [card-def.ts](../../src/engine/types/card-def.ts) に allow-filter を追加。
   case card 継続能力「自分は〚特徴[X]〛以外のキャラを手札から使用できない」。新 helper
   [`handUseCharRestrictAllows`](../../src/engine/flow/main/hand-use-card.ts) が自分の case def の
   `abilities[].continuousModifier.handUseRestrictFilter` を走査し、**手札の使用** (`handUseGateCommon` → canHandUseCard/Switch) +
   **ネクストヒント** ([`runNextHint`](../../src/engine/flow/main/next-hint.ts)) の両経路で **character のみ** gate。
   event / 効果登場 / カットイン / 変装 / ヒラメキ は本 gate を通らない別経路ゆえ対象外 (公式 Q&A と 1 対 1)。
   → B05120 集められた名探偵 (特徴[探偵]) / B06109 紅の修学旅行 (特徴[高校生])。不在時 no-op (既存 case は未宣言 → 全 character 許可)。
   ※ B06103 ジン (カード名 + effect-登場 ban) / UI toCandidate 側の next-hint 候補事前除外は consumer カード出荷時 (card-wave) に配線 = **DEFER**。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- tsc 0 (both tsconfig) / vitest **3489 → 3502 pass** +1 skip (新規 13: boundAnyMatchesFilter 6 [any/no-match/空/未設定/D06013 and 2] +
  handUseRestrictFilter 7 [allow 探偵/block 警察/event 免除/no-restrict allow/switch block/predicate 直呼/next-hint throw+ok])。
- CONDITION_KIND_MAP ⇔ scripts/taskA-validate-specs.cjs CONDS 両方に boundAnyMatchesFilter 登録 (satisfies Record 完全性で tsc 強制)。
- smoke:1000 **winsA=498・winsB=502・timeouts/exceptions 0** = baseline 不変 (= 既存カードのパス不変の実証)。
- 8 lint errors=0。engine-only (card consumer 無) ⇒ playwright N/A (0629d 同方針)。
