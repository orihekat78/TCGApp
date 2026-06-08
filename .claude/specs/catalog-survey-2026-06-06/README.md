# 残カタログ再分類サーベイ (2026-06-06〜07, タスク A) — **完走**

タスク A (engine 変更0 カードバッチ) の土台として、残カタログ全 distinct signature
(= 1071 枚をカバー) を **現行 engine** で 🟢実装可 / 🟡新機能要 / ⚫恒久 defer に分類。
`card-impl-engine-gates.md` (2026-06-04) が stale なため実コードから再構築。

## ✅ 完走 (2026-06-07, inline 分類)

- **wave1** (session #8, 多エージェント workflow): 大型 cluster 240 sig を verifyReason 付き
  (engine file:line 裏取り) で分類。途中 rate-limit 中断。
- **wave2** (2026-06-07 = 本完走): 残 411 sig を **決定的に** 完走 —
  - `build-remaining.ts`: 実 ALL_CARDS(978) + TSV カタログ(2049) から残カードを再現、
    保守的 signature でクラスタ化し、既存 240 verdict と突合して未分類 411 sig を確定 (再現可能)。
  - `classify.ts`: capability-map の gate を**テキストパターン化**して決定的トリアージ
    (138 yellow + 7 black、各 missing-feature ラベル付き)。実 verb list で gate を検証。
  - 残 266 green候補は「**既知 gate 未検出**」= 実装時に card-addition-checklist +
    text-faithfulness Playwright で最終確認する候補 (個別 certify 済ではない)。
- 集約: **`classification-complete.json`** (全 651 sig)、**`task-d-priority-map.json`**、
  **`batch2-green-shortlist.md`** (高信頼 green 手選別)。

### 最終内訳 (651 sig / 1071 枚)
- 🟢 certified green: 4 sig / 8 枚 (wave1 検証済) + 🟢 green候補: 266 sig / 348 枚 (wave2 要最終確認)
- 🟡 yellow: 364 sig / 678 枚 ・ ⚫ black: 17 sig / 31 枚

## 成果物

| ファイル | 内容 |
|---------|------|
| `capability-map.txt` | **70KB 現行 engine capability リファレンス** (verbs/conditions/filters/hooks/cost+dyn/patterns を実コードから)。`card-impl-engine-gates.md` を**置換**する最新ソース。 |
| `classification-partial.json` | 240 sig の verdict (green/yellow/black) + mechanism + 懐疑verify 理由。 |
| `_buckets.json` | yellow を不足機能別に集計 (task D の材料)。 |

## 分類結果 (240 sig / cluster-weighted 枚数)

- 🟢 **green = 4 sig / 8 枚** (懐疑 verify 通過): **B07041**(high)・**B07047**(high)・**B07057**(med)・**B07058**(med)。
  → これが **batch #2 の最有力候補**。ただし B07057/B07058 は med 信頼度のため、実装前に代表1枚を手で踏む。
- 🟡 **yellow = 226 sig / 487 枚**。不足機能トップ (cluster-weighted):
  hand-count condition 66 / remove-area→deck-bottom verb 51 / cutin-subtype filter 44 /
  continuous-aura(他キャラ) 28 / loseGame verb 14 / set-card→host へ能力付与 14 / MR・色数 filter 11 /
  turn-end-removal を他キャラへ付与 6 / partner-area entity slot 5 / event-traits(全空) 2 / **その他(未分類) 246**。
  → これらが **task D (engine 拡張) の優先度マップ**。"その他 246" は手動トリアージ要。
- ⚫ **black = 10 sig / 22 枚**: ほぼ全て **partner-area entity slot / ビッグジュエル / MR-in-partner-area**
  構造ブロッカ (B07030/B07033/B06066/B06074/B06084/B07032/B07039/B07059/B07060/B07061)。B07045/B09047 と同型。

## capability-map.txt が修正した stale ゲート (2026-06-04 → 現行)

`card-impl-engine-gates.md` の以下は **もう FALSE** (タスク C で解禁済):
- card-triggerable hook は「9個」→ 実際 **13個** (+`leave:to-remove` 【現場リムーブ時】, `reasoning:end` 推理反応, `disguise:into` 変装時)
- 「optional flag 無」→ `optional` effect 実装済 (`pendingEffectOptional`)
- 「event→evidence verb 無」→ `selfToEvidence` 実装済
- 「multi-target per-char pick は単一のみ→DEFER」→ apply-pick Pattern A multi-pick で **解禁済** (0191/0528 再評価対象)

依然 TRUE のゲート: continuous aura(他キャラ) / partner-area カード参照 / event traits 全空 /
charSetAP・charSetLP throw / hand-count condition 無 / removeArea 総数 condition 無 / 登場 source-level 無 /
cutin-subtype filter 無 / remove→deck-bottom verb 無 / set-card→host 能力付与 無 / removeOnTurnEnd 未consume /
loseGame verb 無 / partner-ability rewrite 無。

## 次の一手

1. batch #2 = **`batch2-green-shortlist.md`** の高信頼 green を代表1枚ずつ手実装 → full vitest+e2e
   (各カードは card-addition-checklist + text-faithfulness Playwright を必ず通す)。
2. green候補 266 のうち shortlist 外は、実装着手時に個別に全句マッピング確認 (未 certify)。
3. 🟡 不足機能マップ = **`task-d-priority-map.json`** を task D の優先度付けに使用。

## 再生成コマンド (決定的・再現可能)
```
npx tsx scripts/survey/build-remaining.ts   # 残カード再現 → remaining-to-classify.json
npx tsx scripts/survey/classify.ts          # gate トリアージ → classify-triage.json
npx tsx scripts/survey/finalize.ts          # 集約 → classification-complete.json + task-d-priority-map.json
```
