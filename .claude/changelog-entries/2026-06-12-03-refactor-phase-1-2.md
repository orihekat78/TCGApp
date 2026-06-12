# 全体リファクタ Phase 1a〜2c — 挙動不変の構造是正 6 フェーズ完了

**Round/Phase**: 2026-06-12 リファクタ計画 (`.claude/specs/refactor-plan/`) Phase 1a/1b/1c/2a/2b/2c。
全フェーズで挙動不変ゲート (typecheck / full vitest baseline / smoke:1000 baseline 完全一致 /
e2e 回帰 0 / eslint 新規 0) + 敵対レビュー (right-sizing 適用) を通過。

### Phase 1a/1b: mutate 層バイパス排除 + dead code 除去
- contact/hand-use-card/next-hint の直書き 5 箇所を mutate 層 API へ (byte 同一操作)
- `__pendingActionExpansion` side-channel の push 除去 (消費者ゼロ)。charSetAP/LP throw stub は
  レビューで「意図的ガード」と判定し存置

### Phase 1c: テスト fixture 統一
- makeChar/sceneChar/makeCtx 70+ 定義 → `tests/helpers/fixtures.ts` 正準 3 関数 (61 file, −800 行)

### Phase 2a: PA 短縮形 gate 共通化
- uid-carrier 11 verb の awaiting-pick 分岐を `paShortFormAwait` helper に集約。
  chooser/side は明示引数 (BUG-131 裁定の 2 規約併存を明文化)。characterization 7 テスト追加

### Phase 2b: 手動同期 4 系統の単一ソース化
- AtomVerb/Cost/Condition union ↔ 実装 map を `satisfies Record<…>` でコンパイル時強制、
  payInner/evalCond 等に exhaustive default、cjs whitelist は sync テスト 4 本で機械検証

### Phase 2c: dispatch 契約是正 (BUG-116 構造解消)
- 新設 `engine/flow/main/ability-activate.ts` (activateDeclaredAbility / activatePartnerAbility) に
  cost+ctx 構築 + pay を一元化。呼出元 (UI/AI/e2e) は `{type, uid, abilId, costParams?}` のみ —
  cost 渡し忘れによる silent skip が構造的に不可能に
- AI 経路 (policy.applyMove) も同 helper を共有 (greedy picker 値は computeAiCostParams で事前計算)
- effectPickResolve action を 4 形態 union (skip/single/multi/switch) 化
- B06069 e2e に sleepSelf cost 支払い実 assert を追加 (解消の実証)

### 検証 (2c 時点)
- full vitest **1972 pass (baseline 完全一致)** / smoke:1000 **baseline 完全一致** (469/531, avg 10.86) /
  e2e 6 spec 33 pass / eslint 46err=既知 baseline / 規約 lint 7 本 errors=0
- レビュー記録: `.claude/specs/refactor-plan/review-records.md` (phases.md から分割)
