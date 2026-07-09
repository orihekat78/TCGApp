### CARD PHASE hybrid-batch5 — 2行 pool 最終掃き 7 printings + BUG-178 (engine 1行 bugfix)

- **7 printings 出荷**: B07015 服部平次 / B08062 佐藤美和子＆高木渉 / B08064 / B08072 / B08073 /
  B09002 工藤新一&毛利蘭 / PR304 松田陣平。yield 7 EQ / 14 (50%)。**refuse-2行 pool 枯渇** —
  残 = refuse-3行+ (~66 unit) + DEFER cluster (engine mini-wave 待ち、DEFERRED-INDEX batch5 節)。
- **★BUG-178 修正 (engine 1 行 ×2 site)**: `cardNameComponents` / tsv-loader の複数名分割が半角 `&`
  のみで **全角＆ (57 shipped file) を分割せず** — rules/19 複数名ルール (【絆】/カード名 filter /
  同名重ね制限) が破綻していた。probe agent が B08062 の自己条件評価で検出。`split(/[&＆]/)` へ
  (（） は既に両対応、＆のみ非対称)。回帰 = card-name-components-fullwidth.test.ts。smoke 不変 (472)。
- **B09002 a1 authoring 修正**: matcherCondition payloadKey 欠落で production enter 経路不発 (probe
  実測) → payloadKey:'uid' 追加 (B08062 a1 同型)。probe を positive 化して pin。
- probe 34 test green (gen 11 + manual 20 + BUG-178 回帰 3)。
- gates: tsc 0 / vitest 4472→**4506** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0。
