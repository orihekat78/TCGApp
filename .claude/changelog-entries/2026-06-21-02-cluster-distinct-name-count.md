# engine拡張 micro-cluster — distinct-name-count (sceneHas distinctNames 計数、4刷)

**Round/Phase**: 2026-06-21 カード追加 wave。standing green queue 枯渇 (taskA-next-chunk=[]) + engine変更0 残弾尽き
を決定論スキャン (`.tmp/gate-yield-scan.cjs`、未実装 685 cardNum を実テキスト走査) で確証。最クリーンな単一 additive gate
として **distinct-name-count** (「それぞれカード名の異なる〚特徴X〛がN枚以上」rules/19) を engine拡張 micro-cluster 化。

## engine 変更 (1分岐、純 additive)

`src/engine/cond/eval.ts` の `case 'sceneHas'` に `query.distinctNames` honor 分岐を追加。一致候補を
**カード名 (`def.names[0]` 印字名) で dedupe** して計数 (同名2print は1計数)。

- `TargetQuery.distinctNames` は **既存 flag** (従来 pick-resolve `target/resolve.ts` のみ honor、`sceneHas` 計数では
  無視していた)。新 Condition kind なし → union / CONDITION_KIND_MAP / validate-specs CONDS の同期不要。
- **回帰ゼロ確証**: 既存カードで `distinctNames` を使う3箇所 (D08021 / B09010 / B09010P) は全て **pick query 内**、
  `sceneHas` 内で使うカードは0 → 既存カード挙動不変。smoke baseline 不変 (avg 10.998 / winsA 498 / exc 0) が証跡。
- 分割名 dedup の非対称 (`names[0]` vs pick-resolve の全 component): 長野県警 family に分割名カード (rules/19「&」「『』」「()」)
  は不在のため out-of-scope (コメントに将来カード再 certify 注記)。

## 追加カード (2 base / 4 刷、ALL_CARDS 1362 → 1366)

- **B08067 / B08067P 諸伏高明** (黄 L5 AP4000 LP1 警察|長野県警、R/RP):
  「【パートナー黄】【解決編】【登場時】自分の現場にそれぞれカード名の異なる〚特徴［長野県警］〛が3枚以上いる場合、
  レベル7以下のキャラを1枚まで選び、リムーブする。」
  - a1 = `triggered{enter,selfOnly}` + `condition and[partnerColor黄, caseStatus解決編]` +
    `effect conditional{if: sceneHas{distinctNames,trait:長野県警,nMin:3,side:self}, then: sceneRemove{max:1,side:either,filter:levelMax7}}`。
  - 自己包含 (excludeSelf 無) = qAndA「このキャラ自身も数えます」。exemplar D08003 a2 (conditional sceneHas) + PR101 (enter+sceneRemove)。
- **PR236 / PR242 大和敢助** (黄 L7 AP6000 LP1 警察|長野県警、PR、テキスト byte 同一):
  「【宣言】【ターン1】【スリープ】：AP5000以下のスリープ状態のキャラを1枚まで選び、リムーブする。
   【宣言】【ターン1】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に
   それぞれカード名の異なる〚特徴［長野県警］〛が3枚以上いる場合に宣言できる。」
  - a1 = `declared` + `limit turn1` + `cost sleepSelf` (【スリープ】= rules/21 コロン左 cost) +
    `effect sceneRemove{max:1,side:either,filter:apMax5000,state:['sleep']}`。exemplar B09006 a1 byte 一致。
  - a2 = `declared` + `cost sleepSelf` + **宣言ゲート** `condition sceneHas{distinctNames,trait:長野県警,nMin:3}` +
    `effect sceneRemove{max:1,side:either,filter:apMax8000}` (状態不問=state filter 無、a1/a2 の state 非対称が原文一致)。
  - PR242 = PR236 spread (id/no/imageUrl のみ差)。

## 検証

- tsc clean。vitest full **2724 pass / 1 skip / 0 fail** (baseline 2686 から減なし)。
- smoke:1000 **exceptions=0・baseline 不変** (avg=10.998 vs 11、winsA=498 不変) = engine-additive 回帰ゼロ証跡。
- 新規 `tests/cards/distinct-name-count.test.ts` **10件**: 実 `evalCond` で sceneHas distinctNames を駆動。
  §2 ★核心★ = 同名2print+別1 → distinct=2 で `false` / raw(length3)=`true` の挙動差 1対1 witness。
  §3 非trait除外 / §4 side:self (相手除外) / §5 nMin境界 / §6 自己包含 / §7 出荷4カード構造突合。
- **敵対verify (opus、過剰発火+水平展開+fidelity lens)**: **OVERALL SHIP / refute 0**。engine A1-A4 (回帰なし/水平展開漏れなし/
  distinct キー妥当/lookupCardDef 安全) 全 ship、カード fidelity (B08067/PR236 公式テキスト⇔DSL 1対1) 全 ship、exemplar 整合 ship。
- B08063 (黒田兵衛) は a1「このキャラは特徴[長野県警]を持つ」= self-trait-grant continuous (別 gate) のため **DEFER 継続**。
