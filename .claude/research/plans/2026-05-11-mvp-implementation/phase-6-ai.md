# Phase 6: AI (Random / Heuristic)

**Goal:** Engine state を入力に「次の合法手」を決定する AI を実装。Random と Heuristic の2種を切替。

**Files:**
- Create: `src/ai/{policy,random,heuristic,move-enumerator,index}.ts`
- Test: `tests/ai/*.test.ts`, `tests/integration/ai-vs-ai.test.ts`

---

### Task 6.1: 合法手列挙 (move-enumerator)

- [ ] テスト: 任意 GameState から「メインフェイズで取れる全アクション」を列挙
  - cards from hand (色制限通過分)
  - 推理候補 (active + 名乗りなしor迅速)
  - アクション候補 (対象別)
  - 宣言能力候補
  - ネクストヒント可否
  - アシスト・事件解決
  - エンドフェイズへ
- [ ] 実装: 各 `engine.flow.canX` を網羅

### Task 6.2: AIPolicy インターフェース

- [ ] テスト: `policy.choose(state, candidates) => move`
- [ ] 実装: 共通インターフェース

### Task 6.3: RandomPolicy

- [ ] テスト: 同 seed で同手順
- [ ] 実装: `engine.rng.choice` 使用

### Task 6.4: HeuristicPolicy (簡易ルール)

- [ ] 戦略:
  1. 事件解決可能なら即解決
  2. アシスト可+FILE7+で実施
  3. 推理 LP高い順 (証拠 max)
  4. アクション[事件] 可能なら積極的
  5. 残りは Random
- [ ] テスト: シナリオ別 (勝利可能盤面で必ず解決選択 等)

### Task 6.5: AI vs AI 自動プレイ (1試合)

- [ ] テスト: 2 RandomPolicy で1試合完走 (gameResult 出る)
- [ ] テスト: deck-out 敗北パターンも検出

### Task 6.6: 統合: 100戦自動プレイ (smoke)

- [ ] テスト: 100戦で例外/invariant違反なし
- [ ] レポート: 平均ターン数, 勝者分布, 敗北原因

## 完了基準

- 2種ポリシー動作
- 100戦 0 例外
- AI vs AI で勝敗が決まる (時間切れ無し ※ MVP は時間制限out-of-scope)

→ Phase 7 へ
