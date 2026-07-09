# feat(cards): CARD PHASE hybrid-batch2 — refuse-1行 pipeline 本番化 38枚 (2026-07-09)

- **出荷 38 printings** = 23 base + 15 P spread (hybrid pipeline 第2弾、37 unit 選定 → 23 GREEN / 13 DEFER):
  B01051 / B01084 / B01085 / B01095 / B02062 / B03070 / B05012 / B05031 / B05103 /
  B06018 / B06028 / B06043 / B06065 / B06068 / B06082 / B06098 / B07022 / B07032 / B07036 /
  B09016 / B09022 / B09089 / PR302 (vanilla case、corpus 初の abilities:0 登録) + P variant 15
  (B01084P〜B09089P、spread 形 = base def 参照で挙動同一を構造保証。TSV 全列同文 15/15 機械証明済、
  個別 certify/probe スキップ = rules/02 同 ID 規則)。
- **engine touch-up 1 (additive)**: `buildShortFormPick` に短縮形 `excludeSelf` 引数を公開
  (atom-pick-spec.ts。candidates.ts:314 は既 honor、既存カードに使用ゼロ = 挙動不変。consumer B01084)。
- **validator 解禁**: taskA-validate-specs JSON_CONT_KEYS に `caseActionBan` / `grantTraits` / `grantNames`
  追加 (engine union は W2 / wave-6 P37 で出荷済、validator gap のみ)。B05012 (grantNames/grantTraits
  exemplar) がこれで解禁。
- **probe**: tests/cards/hybrid-batch2/ 全 23 file (production dispatch 経路 + human pick 駆動 +
  owner='opp' pin)。misread:performed (B09016) は doReasoning 実 flow、event は handUseCard 実 flow。
- **DEFER 13 unit** → DEFERRED-INDEX「hybrid-batch2 由来」節。最大 cluster = contact-参加者 filter
  cond 不在 (B02006/B02080/PR278、新 cond `contactCharMatches` 1本で解禁可)。
- **test 前提修正 1**: reuse-batch.test.ts の「全件 abilities>0」を kind:'case' のみ免除
  (vanilla case 初出荷。character/event の 0 件 guard は維持)。
- gates: tsc 0 / vitest 4320 pass +1 skip (baseline 4172 から probe +148、減なし) /
  smoke:1000 winsA=472 exc0 + check:smoke-baseline OK / 8 lint errors=0 / crosscheck 14/14 /
  validate-specs 23/23 / 混成 review (sonnet5 意味等価 batch lens + opus engine-touch lens)。
- probe 教訓: 短縮形 excludeSelf は candidates.ts:314 既 honor (露出のみ) / チェッカー regex は
  `smoke-YYYY-MM-DD-N.json` 必須だが初回 run は `-N` なし filename — 手 rename で回避 (latent tooling nit)。
