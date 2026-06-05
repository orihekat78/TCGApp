## タスク C #1: reasoning hook 解禁 — 推理反応を card-triggerable 化 (engine 拡張 中リスク)

**Round/Phase**: 2026-06-06 session — 推奨作業順 B→E→C→A→D の C 第1弾 (engine-extension-plan の reasoning hook)。

「このキャラが推理したとき」等の推理反応 (rules/11) を card-triggerable 化。骨格凍結解除 (2026-06-05 user 承認)
下の additive engine 拡張。leave:to-remove (拡張#1) と同パターン。

### engine 拡張 (additive)

- `doReasoning` は既に `reasoning:end` (source={player, uid}=推理キャラ, payload={uid, player, gained}) を
  emit 済。これを `triggered.ts` の `TRIGGERED_HOOKS` に追加するだけで card-triggerable 化。
- 推理キャラは推理後 scene に sleep で残る → `collectCardsInPlay` に出るため特別 handler 不要、
  通常 in-play scan (`handleHook`) で処理。`selfOnly`=「このキャラが推理したとき」(source.uid 一致)。
- 既存カードに `hook:'reasoning:end'` の triggered ability は 0 件 → 完全 additive (回帰 0)。

### 対応カード (2 枚, ct-p01)

- **B01074 羽田秀吉** (赤Lv4): 推理したとき相手手札公開 (情報のみ=log no-op、D05004 同型)。
- **B01017 本堂瑛祐** (青Lv4): 推理したとき デッキ上2枚見て [探偵] のキャラを1枚まで手札、残りデッキ下
  (deck-look-N D01013 同型 + reasoning トリガ)。filter は `trait:'探偵' + kind:'character'` (BUG-123 教訓)。

### 検証

- typecheck clean / 全 vitest **1804 pass / 1 skip / 0 fail** (回帰 0、reasoning-hook-batch 3 case 追加)。
- e2e `reasoning-hook-2026-06-06.spec.ts`: B01017 推理 → [探偵] D08003 手札 / 非[探偵] D08009 除外を実機確認 (§7)。
- lint (side-channel/listener/eslint/bugs/card-addition) errors=0。

### ALL_CARDS

933 → 935 枚 (+2)。

### 残課題 (reasoning hook 残 ~13 枚)

- 「自分の現場にいるキャラが推理したとき」(B03096/B03102/B05011/B05019 等) = 非 selfOnly +
  byPlayer 側判定 (matcherCondition で side gate)。
- B05039 (推理したとき複数選択) / B08034 (登場時系) / B03038 (LP条件) 等は次バッチで順次。
