# Card Factory State (session 開始時に読む — 再導出を省く)

> 生成: 2026-06-28 session64 (card-factory-plan Task 1〜6)。tooling は main 出荷済。

## EXEMPLAR-SET (出荷済 ALL_CARDS fingerprint + grounded-spec corpus union)

- **1484 cards + 104 spec-corpus / 157 tokens / 558 skeletons**
- 再生成: `npx vitest run tests/factory/dump-shipped.test.ts` → `node scripts/build-exemplar-set.cjs`
  (corpus = `.tmp/certify/*.json` + `_wave-novel-specs.json` の **shipped rep のみ**。`.tmp/` は gitignore = 生成手順がソース)
- ⚠ corpus union は必須: 無いと `__shared`/`__eventUse` 候補が false-T2 (spec は annotation 保持、runtime は codegen 後で消失)。

## classify 分布 (`.tmp/certify` green 98、corpus 修正後)

- **T0=93  T1=5  T2=0** (修正前 T0=76 T1=9 T2=13、false-T2 を corpus union で解消)
- **unshipped green = T1×5 のみ / T0=0 / T2=0**
- ⚠⚠ **5 T1 は全て engine-gated DEFER** (classify T1 ≠ engine0-shippable):
  - B01012 = group-scoped 1-of-N pick 不在 / B05062 = conditional else枝 choice eager-surface + UNION≥4
  - B06058 = optional-gate 喪失 + sceneSetState side hardcoded / B09022 = sceneSetState side hardcoded (refuted)
  - B09056 = choice-in-continuation surface gap (BUG-111系)
  - → adversarial verify が 4/5 で fatal 検出。**token 存在では engine gap を検出できない** (DEFERRED-INDEX/verify が gate)。

## 残カード universe (cards-data TSV、id=col0 cardNum)

- **total 2049 / shipped 1484 / unimplemented 565**。**565 は全て effect text あり = vanilla(無効果) freebie は 0**。
  易しい同型カードは全出荷済 = 現 tail は一様に非自明。

## 効果検証 (Task 6 結論)

- factory tooling は **正しく動作** (positive): classify 正確 (修正後) / crosscheck **93/93 ok** (実 T0、false-fail 0)。
- だが **現 pool に engine0-shippable T0/T1 は 0**: grounded-unshipped は 5 T1 (全 DEFER)、unimpl 565 は全て要 grounding。
- → **30+/session の T0 batch は現 tail では不可**。factory の T0 throughput は (a) 新カードセット発売
  (同型多数→T0 batch) (b) engine 拡張で DEFER 解禁、のいずれかで実現する。盲目 grounding (cluster16 12rep≈2.4M tok)
  は tail が engine-gated ゆえ T0 yield ほぼ0 と予測され ROI 低 → 実行せず。

## engine gate ROI (DEFER 解禁が次の T0 母数を作る、低コスト順)

| gate | 解禁(現pool) | コスト |
|---|---|---|
| sceneSetState 短縮形 side honor | B06058/B09022 | 低 |
| choice-in-continuation surface (BUG-111系) | B09056/B05062 | 中 |
| group-scoped 1-of-N pick | B01012 | 中〜大 |

## 運用

- classifier T0/T1 は **engine0 を保証しない**。必ず `validate-specs` + adversarial verify (T1) / DEFERRED-INDEX 突合で gate。
- 新規性は `rep ∉ shipped-set` で判定 (`shipped-abilities.json` id 集合)。T0 batch 後 dump 再生成 → exemplar 更新。
