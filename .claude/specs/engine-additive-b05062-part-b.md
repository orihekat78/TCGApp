# engine-additive Part B — B05062 解禁 (removeUnionAtLeast + TargetFilter.anyOf)

> Part A (BUG-161 conditional pre-walk fix) は session65 で出荷済 = B05062 gate#2。
> 本 spec は残 gate#1 (removeUnionAtLeast) + gate#3 (TargetFilter.anyOf) + B05062 authoring。
> 出典: session65 grounding workflow (wd3zmsw0w) lensB。fresh session で TDD 実装推奨。

## B05062 鈴木家と京極真 (event, 白, lv7, traits=[])

公式テキスト (TSV ct-p05/event.tsv、★「【事件黒&黄】」は印字に**無い** — orchestrator note の誤り):
> 以下から1つ選んで行う。自分のリムーブエリアに〚カード名［京極真］〛か〚特徴［鈴木財閥］〛のキャラが
> 合わせて4枚以上ある場合、代わりに3つとも行う。（上から順に行う）
> ・カードを2枚引き、手札を1枚リムーブする。
> ・自分のリムーブエリアにあるレベル7以下の〚カード名［京極真］〛かレベル7以下の〚特徴［鈴木財閥］〛のキャラを1枚まで選び、登場させる。
> ・レベル7以下のキャラを1枚まで選び、スリープさせる。

ability = use-triggered (D01014/B05061 exemplar: type:'triggered', scope:'on-hand',
trigger:{hook:'effect:declared', selfOnly:true, matcher:(p)=>p?.kind==='event-use'})。condition 無。

## gate#1: removeUnionAtLeast condition (additive)

「京極真 か 鈴木財閥 が **合わせて** N枚以上」= remove-pile の set-union cardinality。
`or:[removeNameAtLeast(京極真,4), removeTraitAtLeast(鈴木財閥,4)]` は **不可** (2+2=4 を各軸 max2 で false)。

新 Condition kind `removeUnionAtLeast{player, cardName?:string|string[], trait?:string|string[], color?:string|string[], n}`:
remove を1回走査、各カード `d=lookupCardDef(id)`、`matches = nameP || traitP || colorP` (printed: allCardNameComponentsForDef /
d.traits / d.colors — removeTraitAtLeast と同じ printed-only。★B05058 Q&A: 富沢雄三の granted 鈴木財閥 は remove で非カウント)。
**各カード最大1カウント** (両該当でも1)。count>=n。

4点同期 (caseColorNot session62 と同流儀):
- effect.ts:54 — Condition union member (removeNameAtLeast の直後)
- cond/eval.ts:471 — CONDITION_KIND_MAP に `removeUnionAtLeast: true`
- scripts/taskA-validate-specs.cjs:50 — CONDS Set に追加 (sync-taskA-whitelists.test.ts が照合)
- cond/eval.ts ~234 — runtime case (removeNameAtLeast case の直後)

unit test: (a) 両該当カードは1カウント (double-count しない)、(b) 富沢雄三 printed-絵描き で 鈴木財閥 非カウント、(c) 2+2=4 pool で pass。

## gate#3: TargetFilter.anyOf (additive) — SUB2 候補 filter の name-OR-trait union

SUB2「レベル7以下の〚京極真〛か レベル7以下の〚鈴木財閥〛のキャラ」= **候補選択**の name-OR-trait union。
matchOneFilter は cardName AND trait (early-return guard) → 単一 TargetFilter で OR 不可。
`TargetFilter.anyOf?: TargetFilter[]` を 3 filter-eval site で honor (cardNameNot/colorNot と対称):
matchOneFilter (candidates.ts) / targetFilterToPredicate / boundMatchesFilter。
SUB2 = sceneEnter{from:'remove', max:1, viaEffect:true, filter:{levelMax:7, kind:'character', anyOf:[{cardName:'京極真'},{trait:'鈴木財閥'}]}}。
(別案: filter.custom closure は JSON 非直列化で不可。)

## B05062 DSL (Part A 済 + gate#1/#3 後)

```
a1.effect = conditional{
  if: removeUnionAtLeast{player:'self', cardName:'京極真', trait:'鈴木財閥', n:4},
  then: sequence[SUB1, SUB2, SUB3],         // 代わりに3つとも (上から順)
  else: choice{chooser:'self', options:[SUB1, SUB2, SUB3]},  // 1つ選んで
}
SUB1 = sequence[draw{self,n:2}, discard{self,n:1}]   // 両方 mandatory 'する'
SUB2 = sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, filter:{levelMax:7, kind:'character', anyOf:[{cardName:'京極真'},{trait:'鈴木財閥'}]}}
SUB3 = sceneSetState{player:'self', side:'either', max:1, state:'sleep', filter:{levelMax:7}}
```

## エッジ / Q&A
- 「3つとも行う」途中でリフレッシュ等で条件を満たさなくなっても3つとも行う → `if` は1回評価で sequence 全実行 (満たす)。
- SUB1 deck-empty (draw n:2、deck=1): 1枚→リフレッシュ→残り解決 (draw atom 既存 refresh 配線、rules/26)。smoke で n:2 mid-refresh 確認。
- 「1枚まで」= max:1 (0可、Q&A明記)。SUB2 not enterSleep (plain 登場)。
- conditional の then/else は Part A (BUG-161) で human 経路の over-fire 解決済 (前提)。

## 検証計画
gate#1/#3 各 unit test → tsc/validate-specs/full vitest (baseline) → smoke baseline → B05062 gate5 human-path probe
(条件<4=choice 経路 / >=4=3つとも、SUB2 の anyOf 候補に decoy[Lv8京極真/絵描き富沢/鈴木財閥Lv7] 同居で 1対1) → opus 敵対 review。
