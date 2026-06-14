# 作業ログ — 名探偵コナンTCG プロジェクト

> scratchpad (現セッション)。durable 記録は CHANGELOG.md / changelog-entries / 設計 doc / git。

## 2026-06-14〜15 セッション: cluster6 + cluster7 完了 (branch `cards/wave2-cluster6`)

### cluster6 ✅ (commit 227aaa68) — engine拡張 wave#2、usage-restriction (event-use ban)
- B09034/B09034P「黄金千枚二千杯」(緑イベント lv5、P=同文 reprint) 解禁。ALL_CARDS 1161→1163。
- engine additive: 新 verb `setEventUseBan` (3点同期 effect.ts/validate.ts/taskA-validate-specs.cjs) +
  `TurnScopedFlags.eventUseBanned` (game-state.ts、reset=mutate/flag.ts) +
  hand-use-card.ts handUseGateCommon / next-hint.ts step2 / UI useActionsPanelFlow.ts toCandidate に
  **event-only** gate (公式 Q&A: カットイン/ヒラメキは非ゲート)。
  `handAddFromRemove` に複数pick path (`$pick.cardIds`、charStackCard 同型) 追加 (B09034「2枚まで」用)。
- clause1→clause2 は **sequence** (chain でない → 0 pick でも ban 発火、resolver.ts は __chainStepNoApply break しない)。

### cluster7 ✅ (commit 3f8f1a0e) — engine変更0 card-authoring (骨格凍結原則完全準拠)
- B07067 沖矢昴 (R) / B07070 新出智明 (C)。ALL_CARDS 1163→1165。**handAtMost / handCountAtLeastOther の初消費者**
  (triage の「B07081/B09092 が使用」は誤り、grep 0 hit)。
- 全パターン既存カード実証済 (charModifyAP carrier bind:$picked=B07079 / charGrantKeyword $bound.uid=PR181/187 /
  top-level custom=B07071 / sleepChar pick=B03060 / $contact.byUid cutin=B07006)。設計は 2 opus agent + 決定論 grep 再検証。

### 検証 (heavy gates、cluster6+7 合算で1回 ← ユーザー指示)
- full vitest **2105 pass** (1 skip、2091+8+6) / smoke:1000 baseline **完全一致** (winsA469/avg10.863/timeouts0/exceptions0
  = no-op 実証) / e2e playwright **119 passed** (1 skip) / tsc exit 0 / validate-specs 70 pass 0 fail。
- 専用挙動 vitest: cluster6 8件 (gate/verb/reset/cutin・hirameki exempt/0・1・2 pick) /
  cluster7 6件 (handAtMost・handCountAtLeastOther gate/pick-buff/declared self-state gate)。
  - ⚠ test harness 教訓: PA 短縮形 (charModifyAP/sceneRemove) は実行時 atom-handler 解決 (resolve-picks.ts:438) →
    runEffect 後に `_drainAllEffectPicksForTest` (AI drain) 必須 (cluster4 同型)。PB (handAddFromRemove) は resolveEffectPicks で pre-fill。

### 残: main 反映 (ユーザー: push 失敗時はスキップ可)
- branch `cards/wave2-cluster6` に 2 commit。main ff-merge + push + CI green 確認 (失敗時スキップ)。

## ポインタ
- 設計記録: `.claude/specs/engine-wave2-cluster5-usage-restriction-design.md` (§cluster6)
- triage: `.tmp/cluster4-triage.json` (gate6種: usage-restriction/remove-area=済、他4はdefer。hand-count gate は vacuous だが B07067/B07070 が現行 engine 実装可と判明→cluster7)
- 繰越 (DEFERRED-INDEX): BUG-143/144・hirameki抑止・action-restriction(B07005)・observer contact-removal(D02008/B05066)・external hook firing(B08078)
