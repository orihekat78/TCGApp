### CARD PHASE hybrid-batch4 — 2行 refuse-unit pipeline 18 printings (engine変更0)

- **18 printings 出荷**: PR289+PR295 / PR292+PR298 (twin) / B03047 京極真 / B03050 怪盗キッド / B03080 /
  B03134 / B04027 / B04032 / B04077 / B05051 / B05081 / B05086 / B06063 / B06072 / B06074 / B06084。
  1行 pool 枯渇後の初の 2行 unit batch (novel 2 行/unit)。yield **16 EQ / 40 = 40%** (batch3 の 30% を上回る)。
- **DEFER 22 + VERIFY_NG 2** は DEFERRED-INDEX「hybrid-batch4 由来」節 (`.tmp/_batch4_defers.txt` に全文)。
  mini-wave cluster 追記: ⑥next-hint 判別 hook (4 unit) ⑦「選ばれたとき無効」intercept ⑧hand 内 continuous。
- **tooling**: validate-specs JSON_CONT_KEYS に colorIgnoreOnHandUse (mega-W2 出荷済の stale whitelist 3例目)。
  B05081 の trigger.matcher 文字列は __eventUse:true へ正規化 (author 出力の機械修正)。
- probe: gen 15 file 中 10 修正 (agent 2 体) + manual-probes 21 test (agent 1 体、action:guarded /
  disguise:into / phase:end:start / cutin / continuous 直 drive)。batch4 計 54 test green。
- gates: tsc 0 / vitest 4418→**4472** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0 / 意味等価 lens 18 枚。
