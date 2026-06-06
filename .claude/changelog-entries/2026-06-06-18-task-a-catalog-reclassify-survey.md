## タスク A: 残カタログ再分類サーベイ (多エージェント workflow、部分完了)

**Round/Phase**: 2026-06-06 session #8 — タスク A batch #2 の土台。残 661 distinct signature
(= 1071 枚) を現行 engine で 🟢/🟡/⚫ 再分類する 4-phase workflow (~75 agent) を実行。

### 成果物 ([.claude/specs/catalog-survey-2026-06-06/](catalog-survey-2026-06-06/))

- **capability-map.txt (70KB)** — 現行 engine 能力を実コード (verbs/conditions/filters/hooks/cost+dyn/patterns)
  から再構築。`card-impl-engine-gates.md` (2026-06-04 stale) を置換。card-triggerable hook は「9個」→
  **13個** (leave:to-remove/reasoning:end/disguise:into 追加)、optional・selfToEvidence・multi-target pick が
  解禁済を確定。
- **classification-partial.json** — 240 sig の verdict + mechanism + 懐疑 verify 理由。
- **_buckets.json** — yellow を不足機能別集計 (task D 優先度マップ)。

### 分類結果 (240/661 sig)

- 🟢 **4 sig / 8 枚** (懐疑 verify 通過): B07041(high)・B07047(high)・B07057(med)・B07058(med) = batch #2 候補。
- 🟡 **226 sig / 487 枚**。不足機能トップ: hand-count cond 66 / remove→deck-bottom verb 51 /
  cutin-subtype filter 44 / continuous-aura(他キャラ) 28 / loseGame verb 14 / set-card→host 能力付与 14。
- ⚫ **10 sig / 22 枚**: ほぼ partner-area entity slot / ビッグジュエル / MR-in-partner-area 構造ブロッカ。

### ⚠ 部分完了 / 中断

- chunk 00–11 (240 sig) のみ分類済。chunk 12–33 (残 421 sig) + verify + synthesize は
  **API rate-limit + 「subscription access disabled」** で失敗 (agent 53/~75)。残りは次回 workflow 再実行が必要。
- synthesize 未生成 → バッチ計画は README で手動代替。
- workflow が session 中断で orphan 化 (5h idle) → journal 経由 resume で完走させた。

### engine 変更 / カード追加

- なし (調査・記録のみ)。ALL_CARDS は 978 のまま。
