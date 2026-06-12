# BUG-140 補修 wave — 出荷済 74 枚の cutIn/hirameki 欠落を一括補修 + lint 恒久化 (engine変更0)

**Round/Phase**: 2026-06-13 BUG-140 補修 wave (`fix/bug-140-icon-abilities`)。
cluster2 の MCP decoy 検証で発見した「TSV cutIn/hirameki 列の取りこぼし」(BUG-140) の専用補修。
engine 変更 0 (カード def + テスト + lint のみ)。

### 一括補修 (決定論パッチ)

- `scripts/fix-bug140-icon-abilities.mts` (dry-run→write、未分類/anchor 不一致は fail) で
  欠落 76 行を機械補修:
  - **直接 patch 52 ファイル** — 7 テンプレの正準形を verbatim 追記
    (h-draw 31: D03011 a2 / h-sleep 12: D05007 a2 明示 $pick+target / h-evid 17: evidenceGain /
    h-removeYellowToHand 2: B01094 自身 a1 同 atom / c-ap1000 3 + c-ap2000 4: D08015 a2 /
    c-turnAP 5: B04096 a2 conditional)
  - **spread 再録 22 行は base 補修で自動継承** — 全 20 ペアの TSV テキスト一致を機械検証
  - **DEFER 2 枚** (B05039: contact 対象特徴条件が Condition union 不在 / B06035: hirameki fire
    経路内 chain+条件 gate 未確証) → DEFERRED-INDEX へ理由付き繰越

### 防止策の恒久化

- `npm run lint:icon-abilities` 新設 (defHasKeyword 単一真実源 + DEFER allowlist + stale allowlist
  検知)。pre-commit と GitHub Actions CI の規約 lint **8 本目** として組込み
- card-addition-checklist §0 に「TSV cutIn/hirameki/henso 列の非空確認」を追記

### 検証

- 挙動テスト 8 件新設: `tests/integration/bug-140-hirameki-batch.test.ts` (4 テンプレ × 実 fire
  経路、色/種別 decoy で filter 検証) + `tests/engine/flow/bug-140-cutin-batch.test.ts`
  (3 テンプレ × 実 contact 経路、turn 条件両分岐)
- 全ゲート green: tsc / vitest 2024 (+8) / smoke:1000 baseline 完全一致 (補修カードは MVP smoke
  デッキ外) / e2e 119 passed / lint 8 本
