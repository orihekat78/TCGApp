# Phase 3: Effect Descriptor + Resolver + Hooks + Cost + Targeting + Conditions

**Goal:** [engine-api-effect-descriptor.md](../../../specs/engine-api-effect-descriptor.md) の DSL を解釈する Resolver を作り、[engine-api-events.md](../../../specs/engine-api-events.md) の Hook 機構、[engine-api-cost.md](../../../specs/engine-api-cost.md) コスト評価、[engine-api-targeting.md](../../../specs/engine-api-targeting.md) 対象選択、[engine-api-conditions.md](../../../specs/engine-api-conditions.md) 条件評価を実装。

**Files:**
- Create: `src/engine/effect/{descriptor,resolver,atom-handlers}.ts`
- Create: `src/engine/event/{registry,emit}.ts`
- Create: `src/engine/cost/{evaluate,pay}.ts`
- Create: `src/engine/target/{candidates,resolve}.ts`
- Create: `src/engine/cond/{eval}.ts`
- Create: `src/engine/resolve/{stack,run}.ts`
- Create: `src/engine/dyn/{eval}.ts` (G24)

---

### Task 3.1: Hook Registry (engine.event.on/emit)

- [ ] テスト: on で listener 登録 → emit で発火 → 戻り値 Effect が pendingEffects に積まれる
- [ ] 実装: Map<HookName, Listener[]> + Unsubscribe 返却

### Task 3.2: Atom Verb ハンドラ (descriptor → mutation 委譲)

- [ ] テスト (per verb): draw/discard/sceneEnter/sceneRemove/charModifyAP/.../partnerAssist/caseToResolved
- [ ] 実装: `src/engine/effect/atom-handlers.ts` に dispatcher (verb→engine.mutate.* 呼出)
- [ ] 30+ verb 全数テスト

### Task 3.3: 動的式 evaluator (engine.dyn.eval) (G24)

- [ ] テスト: `$self.ap` `$cost.flipFaceUpEvidence.count` `$contact.byUid` 評価
- [ ] 実装: limited expression eval (no eval()。事前定義された path のみ許可)

### Task 3.4: Targeting (engine.target.candidates / resolve)

- [ ] テスト: TargetQuery filter / filterAny / state / excludeSelf / distinctNames 動作
- [ ] テスト: 「N枚まで」で 0枚選択可 (rules/15)
- [ ] 実装

### Task 3.5: Cost evaluator (canPay / pay)

- [ ] テスト: 各 Cost.kind (sleepSelf, removeFromHand, removeDeckTop, flipFaceUpEvidence, pay/choice)
- [ ] テスト: viaCost フラグ伝播 (rules/21, 25)
- [ ] 実装

### Task 3.6: Condition evaluator

- [ ] テスト: 各 Condition.kind (turn, partnerColor, caseColor, fileAtLeast, sceneHas, removeColorAtLeast, bound, stackedCountAtLeast, declaredUseUnder)
- [ ] テスト: 条件不成立 → ability 持たない扱い (rules/17)
- [ ] 実装

### Task 3.7: Effect Resolver (sequence/choice/optional/conditional/forEach/replace/negate/atom)

- [ ] テスト: kind 別に DSL 解釈
- [ ] テスト: optional スキップ / forEach 反復 / replace で trigger 置換 / negate で cancel
- [ ] 実装: `src/engine/effect/resolver.ts`

### Task 3.8: Effect Stack (engine.resolve.queue/next/runOne/runAllUntilEmpty)

- [ ] テスト: 同タイミング複数発火 → ターンプレイヤー優先順 (rules/15, 25)
- [ ] テスト: 所有者順序選択 (requestOwnerOrder)
- [ ] テスト: 即時例外 (replace/negate) は積まない (rules/15)
- [ ] テスト: 解決中ロック
- [ ] テスト: 効果が解決失敗でも「発動した扱い」(rules/24, 【ターン①】カウント)
- [ ] 実装

### Task 3.9: Validator (engine.effect.validate / engine.cards.validate)

- [ ] テスト: kind:'custom' 以外 JSON シリアライズ可
- [ ] テスト: ability id 重複検出
- [ ] テスト: ruleRefs が rules/ 配下に存在 (ファイル存在チェック)
- [ ] 実装

### Task 3.10: 統合テスト (Hook→queue→Resolver ラウンドトリップ)

- [ ] テスト: 「現場登場 Hook → 登場時能力 effect 積む → resolver 実行 → 結果反映」 を 1 シナリオで通す

## 完了基準

- 全 atom verb 動作
- Resolver が 全 Effect kind 解釈可能
- Hook 機構が rules/15 順序通り
- カバレッジ ≥ 85%

→ Phase 4 へ
