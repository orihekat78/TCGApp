# engine additive wave: TargetFilter `colorNot` (2026-06-27)

> 骨格凍結 additive 例外 (CLAUDE.md「骨格凍結原則」公式ルール由来の新表現)。
> cluster16 `cardNameNot` の color 版。filter-predicate 4 site を mirror。

## 解禁する文言

- **「【X】以外の色を持つキャラ」** (キャラ TargetFilter / sceneHas 条件)
- 対象カード例: B02010 (target pick) / B08082 (手札 pick) / B07012 (sceneHas cond + hirameki pick) /
  B02002 / B08081 / B08090 / B08091 (sceneHas cond)

## semantics (公式 B08079 裁定で確定)

> B08079 ピンガ qa: Q「自分の事件が《裏切りの街角/0930》(黒+他2色) の場合は宣言できますか」
> A「はい。**【黒】を含む2色以上の事件でも条件を満たします**」

- カード文「【X】以外の色を持つ」= **X以外の色を1つ以上持つ** (= `colors.some(c => c∉notSet)`)
- mono-X → 除外 / 2色{X,Y} → 該当 (Y を持つ) / mono-Y → 該当
- 等価: **全色が notSet 内のとき除外** (= 非Xの色を1つも持たないとき除外)
- ⚠ `cardNameNot` (any-match 除外: いずれかの component が一致したら除外) とは**非対称**。
  単色カードでは両者一致するが、2色カードで分岐する (公式 some説)。

## 型 (effect.ts `TargetFilter`)

```ts
colorNot?: string | string[];
```

新 optional field。既存カードは未宣言 → 全 eval が unchanged → **smoke winsA=498 不変 (回帰0)**。

## honor sites (4、`cardNameNot` を mirror)

| site | 関数 | 述語 |
|------|------|------|
| `target/candidates.ts` | `matchOneFilter` (target pick / sceneHas cond / auraDelta 再入) | `!(d?.colors ?? []).some(c => !nots.includes(c)) → return false` |
| `cond/eval.ts` | `boundMatchesFilter` (bound card inline eval) | 同式 (`f.colorNot`、`d?.colors ?? []`) |
| `effect/atom-handlers/_shared.ts` | `targetFilterToPredicate` (deckRevealUntil path) | 同式 (`d.colors`、d は早期 non-null) |
| `types/effect.ts` | 型定義 | 上記 field |

3 eval site は cluster2 教訓 (silent drop) のため **必ず sync**。各 color positive block 直後に配置。

## scope 外 (別 gate、DEFER)

- **caseColor「事件が【X】以外の色を持つ/持たない」** (B08079 宣言条件 / PR274/275 自分ターン中 /
  D10013/B05010/B05036/B05070/PR169… cutin) = `caseColor` 条件 kind の negation/other 拡張。別 wave。
- handReveal verb / 手札 reveal-then-condition は本 wave 対象外。

## edge cases

1. **mono-color (大多数)**: colorNot=X → 結果は naive 除外と同じ (color≠X)。
2. **2色含X**: 該当 (公式 B08079 裁定)。some説の分岐点。
3. **colorNot + color 併記**: 各 filter 独立適用 = AND (自然)。
4. **array colorNot** (`['青','赤']`): 「{青,赤} 外の色を持つ」。緑持ち=該当 / mono-青=除外 / mono-赤=除外。
5. **colors 空 / def 不在 (d=null)**: `(d?.colors ?? [])` → some=false → 除外 (保守)。実カードは色必須なので無害。

## tests

`tests/cards/engine-colornot-filter-2026-06-27.test.ts`:
- §1 matchOneFilter × {mono-X除外, mono-Y該当, 2色XY該当(裁定), array}
- §2 targetFilterToPredicate 同上
- §3 boundMatchesFilter (evalCond) 同上
- §4 additivity (colorNot 未宣言 → 全該当 / color positive と co-exist)

## gates

tsc0 / 新 test / smoke:1000 winsA=498 (check:smoke-baseline) / 8 lint + eslint / validate-specs →
opus 5-lens 敵対 review (additivity / 完全性 / semantics忠実 / test adequacy / edge) → concern反映 → FF push。
