# engine additive: Condition `caseColorNot` (2026-06-27 セッション62)

> 骨格凍結 additive 例外 (CLAUDE.md「骨格凍結原則」公式ルール由来の新表現)。
> session60 `colorNot` (TargetFilter) の **Condition 版**。caseColor の some説 negation。

## 解禁する文言

- **「自分の事件が【X】以外の色を持つ場合」** (条件アイコン / Condition)
- 対象カード例 (card session 领分、engine0 で出荷可):
  - PR274 / PR275 工藤新一 — `【自分ターン中】自分の事件が【青】以外の色を持つ場合、…AP＋1000` (continuous gate)
  - B08079 ピンガ — `【宣言】…この能力は自分の事件が【黒】以外の色を持つ場合に宣言できる` (宣言 gate) ✅ **出荷済 (2026-06-27、`cards/wave-casecolornot-0627`、a3 完成)**

## semantics (公式 B08079 裁定で確定 — colorNot と同一 some説)

> B08079 ピンガ qa: Q「自分の事件が《裏切りの街角/0930》(黒+他色) の場合は宣言できますか」
> A「はい。**【黒】を含む2色以上の事件でも条件を満たします**」

- カード文「事件が【X】以外の色を持つ」= **X以外の色を1つ以上持つ** (= `caseColors.some(c => c∉notSet)`)
- mono-X → false / 2色{X,Y} → true (Y を持つ) / mono-Y → true / 空事件色 → false
- 等価: **全事件色が notSet 内のとき false** (= 非Xの色を1つも持たないとき false)

### ⚠ 既存 `not(caseColor X)` では表現不能 (新 kind 必須の根拠)

| 事件色 | 「【黒】以外の色を持つ」(求める some説) | `not(caseColor 黒)` (none説) |
|--------|--------------------------------------|------------------------------|
| {黒}   | false (黒以外なし)                   | false |
| {黒,赤}| **true** (赤がある)                  | **false** ← 分岐 |
| {赤}   | true                                 | true |

2色 {X,Y} で分岐 → `not` 合成では公式裁定を満たせない。colorNot vs cardNameNot と同型の非対称。

## 型 (effect.ts `Condition` union)

```ts
| { kind: 'caseColorNot'; color: string | string[] }
```

新 kind。既存カードは未宣言 → 全 evalCond が unchanged → **smoke winsA=498 不変 (回帰0)**。
`combine` flag 無し (YAGNI: 対象カードは単色。array は caseColor/colorNot とパリティで無料維持)。

## 色解決 (caseColor と同一)

`lookupCardDef(caseInfo.cardId)?.colors ?? caseInfo.colors ?? []`。CardDef が primary、
runtime fallback は caseInfo.colors (test / lazy load 時)。

## honor site (4点 — Condition は中央集権評価ゆえ colorNot の filter 4経路より単純)

1. `src/engine/types/effect.ts` — Condition union に追加
2. `src/engine/cond/eval.ts` — `case 'caseColorNot'` + `CONDITION_KIND_MAP` 追加
   (`CONDITION_KINDS` は MAP の Object.keys → 自動波及、sync test が import)
3. `scripts/taskA-validate-specs.cjs` — `CONDS` 配列に `caseColorNot` 追加
4. `tests/engine/sync-taskA-whitelists.test.ts` — CONDITION_KINDS⇔CONDS 自動 enforce (手修正不要)

他の Condition consumer (resolver / candidates / declared-ability / triggered / contact / stack)
は全て `evalCond` を呼ぶのみ → 単一 switch 追加で自動 honored。

## test (RED→GREEN、bug159 colorNot test を mirror)

- mono-X 除外 (false)
- 2色{X,Y} 該当 (true)
- 非X単色 該当 (true)
- 空事件色 false
- array notSet ({X,Y} 指定 → 全色が⊆なら false / 外があれば true)
- vs `not(caseColor)` 非対称 (2色{X,Y} で caseColorNot=true・not(caseColor)=false)

## gate

tsc0 / 新テスト全 pass / smoke:1000 winsA=498 完全一致 (additive 回帰0) / full vitest / 8lint+eslint。
→ opus 5-lens 敵対 review (additivity / 完全性 / semantics 公式整合 / edge / test adequacy)。

## 既存 `caseMonoColor` (_shared) との関係 (review nit 反映)

「事件が【X】以外の色を**持たない**」(none説) family は **既存 shared class
`caseMonoColor`** (`src/cards/_shared/caseMonoColor.ts` = `not(caseColor[他5色])`) で
処理済 (B05010/B05036/B05070/B08090 等)。caseColorNot に mis-route されない (kind が別)。

両者は論理的に補集合 (色 ⊆ 6色集合の下で):
- `caseColorNot(X)` = 事件が X以外の色を持つ = 事件 ⊄ {X}  (some説)
- `caseMonoColor(X)` = 事件が X以外を持たない = 事件 ⊆ {X}  (= `not(caseColorNot(X))`)

→ **将来 (別 wave、振る舞い不変だが要 smoke gate)**: `caseMonoColor` を
`not(caseColorNot(X))` へ簡約すると ALL_COLORS の 6色 hardcode を除去でき robust 化。
本変更には含めない (shipped card B05010/B05036/B05070/B08090 の経路に触れるため別 gate 必須)。

### なぜ complement-enum (`caseColor[他5色]`) でなく engine kind か
`caseColorNot(X)` は `caseColor[ALL_COLORS\X]` (OR membership) と等価で既存 engine でも表現可。
だが complement-enum は **6色 hardcode で脆い** (色追加で silent break)。session60 が同理由で
`colorNot` TargetFilter を engine 正準形として採用済 (memory reference-colornot-some-semantics)。
caseColorNot はその Condition 版で一貫。hardcode 無しで robust。

## out of scope

- `caseMonoColor` の `not(caseColorNot)` 簡約 — 別 wave (上記、要 smoke gate)。
- caseColor 既存 `combine` の negation 合成 — 不要 (some説固定)。
- card 実装 (PR274/PR275/B08079) は card session 领分。
