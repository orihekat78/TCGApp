# Card Factory State (session 開始時に読む — 再導出を省く)

> 生成: 2026-06-28 session64 (card-factory-plan Task 1〜5 出荷時)。tooling は main。

## EXEMPLAR-SET (出荷済 ALL_CARDS fingerprint)

- **1484 cards / 152 tokens / 544 skeletons**
- 再生成: `npx vitest run tests/factory/dump-shipped.test.ts` → `node scripts/build-exemplar-set.cjs`
  (`.tmp/card-factory/{shipped-abilities,exemplar-set}.json` は gitignore = 生成手順がソース)

## 直近 classify 分布 (`.tmp/certify`, green 98 / 206 specs)

- **T0=76  T1=9  T2=13** (`node scripts/card-classify.cjs .tmp/certify`)
- ⚠ **T0 unshipped = 0**: 76 T0 は **全て出荷済** (exemplar が ALL_CARDS 由来 → 出荷済カードは skeleton 同型で必ず T0)。
  当 certify pool の「易しい同型カード」は前 session 群で出荷済 = **T0 枯渇**。
- unshipped green candidates:
  - **T1 ×4**: B01012, B06058, B09022, B09056 (token 既出・構造新規 → grounding + 1-lens opus 経路)
  - **T2 ×1 green**: B05062 (novel-token → engine 拡張 or フルゲート)
  - T0 ×0
- 残 108 specs は verdict=yellow (未 certify green) = batch 不適格。

## 次に新 T0 を得る方法 (重要)

T0 の節約は「**敵対 opus / 4-lens / playwright を省略**」であって **grounding 省略ではない**。
新 T0 候補を作るには:
1. 未実装カード (universe−実装、memory: 残 ~632) のチャンクを選定 (`taskA-next-chunk.cjs` / catalog-survey)
2. grounding certify で abilities を起こし `.tmp/certify` に green spec を追加
3. `card-classify.cjs` で T0 を抽出 → crosscheck → validate-specs → tsc → codegen → register
4. batch 末尾に full vitest + smoke + 代表1枚 playwright

→ 当 certify pool は枯渇のため、**初回 live batch は fresh grounding pass が前提** (Task 6 ブロッカー、要方針決定)。

## engine gate ROI 表 (DEFERRED-INDEX gate 別、design 見積、低コスト順)

| gate | 解禁枚数 | コスト |
|---|---|---|
| continuous level-delta read site | 2+ | 低 |
| ability-presence filter | 1 | 低 |
| removed-by-this-effect condition | 1 | 低〜中 |
| set-card→host 付与 | 4 | 中 |
| partner-area 構造 | 4 | XL |

> 数値は card-factory-risk-tiered-design.md の見積。正確な解禁枚数は DEFERRED-INDEX.md 再集計で更新。

## 運用

- T0 batch を回すたび dump 再生成 → exemplar-set 更新 (新 skeleton が次回 T0 母数を増やす)。
- classifier は出荷済を T0 と判定する (exemplar が出荷由来)。**新規性は rep ∉ shipped-set で判定**:
  `shipped-abilities.json` の id 集合に rep が無いものだけが live batch 候補。
