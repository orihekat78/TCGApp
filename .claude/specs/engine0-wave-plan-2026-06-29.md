# ENGINE0 まとめ追加 wave 実行計画 (2026-06-29 prep)

211 ENGINE0 候補のまとめ追加 campaign。**次 fresh session 以降で実行**。本ファイルが driver。

## 前提・注意 (必読)

- 211 は分類器楽観値 + stale 補正の **候補**。確定ではない → **各カード certify 必須**、一定割合は却下 (false-ENGINE0) される = 想定内。
- 厳格プロセスは [card-wave skill](../skills/card-wave/SKILL.md) に従う。`green候補は未certify なら信用しない`。
- コスト: certify ≈ 200k tok/rep、~20 rep/窓、**SUB=8 直列** (本調査 session で server rate-limit 2回踏んだ → 高並列厳禁)。
- 着手前に **working tree clean** (auto-docs/NEXT-PROMPT の M ファイル解消、並行session contamination に注意 [[feedback-parallel-docs-contamination]])。branch 例 `cards/wave-engine0-tierA`。

## 入力データ (durable)

- per-card 判定: [engine0-vs-extension-2026-06-29.tsv](engine0-vs-extension-2026-06-29.tsv) (num/kind/verdict/gates/title)
- cluster 割当: [engine0-wave-clusters-2026-06-29.tsv](engine0-wave-clusters-2026-06-29.tsv) (tier/cluster/num/kind/stale_gate/title)
- 調査資料: [engine-extension-upper-bound-2026-06-29.md](engine-extension-upper-bound-2026-06-29.md)
- 実テキストは `.claude/specs/cards-data/<pkg>/*.tsv` から member 毎再取得 (signature は抽象化済)

## 実行順 (信頼度順、cluster 単位 = certify batch)

### Tier A — pilot (10枚、最高信頼。最初の校正用)
- `C04_untargetable` (8): B01006/P B03030/P B03093 B05008/P B05048 — untargetable「選ばれない」= 出荷済 pattern
- `C01_relAP_filter` (2): B09096/P キャンティ — `resolveFilterDynObj` field-agnostic + candidates.ts:345 same-AP (P55 verify 済)
- → これで certify→codegen→6ゲート→commit を1周し **hit率を測定**。分類器精度を校正してから Tier B へ。

### Tier B — 本体 (183枚、出荷済 pattern。高 throughput)
cluster 別に batch (大→小): `C07_hirameki`(55) `C09_keyword_grant`(44) `C10_declared_cost`(22) `C06_cutin`(19) `C11_enter_effect`(15) `C16_draw_search`(13) `C15_evidence_op`(5) `C08_henso`(4) `C05_misread`(3) `C12_turnend`(3)。
1 session = 1〜2 cluster + `/clear` (skill のコンテキスト衛生)。

### Tier C — 要注意 (18枚、border。個別 certify)
`C02_relLevel_filter(G16)` `C03_revealed_color(G17)` `C99_other`(16 heterogeneous)。
G16 level path / G17 n>1 は candidates 適用が未確認 → certify で確定/却下。other は1枚ずつ grounding。

## 各 cluster の手順 (card-wave §2-6)

1. branch + member の実テキスト再取得
2. **certify**: `node scripts/wf-certify.mjs <ids>` (grounding→adversarial verify、`model:'opus'`、SUB=8)。verdict → `.tmp/certify/<rep>.json` (窓跨ぎ再開用)。yellow/疑義は実装せず DEFER ([DEFERRED-INDEX.md](DEFERRED-INDEX.md) 追記)
3. codegen: `taskA-collect-greens` → `taskA-validate-specs` (engine変更0 機械保証) → `taskA-codegen --write` → `taskA-register`
4. 6ゲート: validate-specs / `tsc --noEmit` / `vitest run` / `smoke:1000`+`check:smoke-baseline` (baseline 不変=engine変更0証跡) / **playwright MCP 実機 decoy 検証** / `pre-commit`
5. 記録: changelog-entries 手書き + `npm run docs` (最後1回) + memory/session log
6. commit `feat(cards): wave engine0 <cluster> — N枚 (engine変更0)` + Co-Authored-By → main ff → push → CI green 確認

## 想定アウトカム

- Tier A hit率で全体の歩留まりを推定。仮に 70% green なら 211 → ~150枚 ship。
- 却下分は engine 拡張 candidate として [engine-extension-upper-bound-2026-06-29.md](engine-extension-upper-bound-2026-06-29.md) の gate へ回送。
- 全 cluster 完了で「ENGINE0 vein」を実質枯渇 → 以降は engine 拡張 (~75件) フェーズへ。
