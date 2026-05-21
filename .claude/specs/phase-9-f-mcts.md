# Phase 9-F: MCTS AI Policy (MVP: Rollout-based)

## 目的

`HeuristicPolicy` を超える AI 強度を Phase 9-H で確立した時間予算 (100ms / turn) 内で実現する。
Phase 9-H 計測 baseline: avg=0.19ms / max=4.84ms per turn → 100ms 予算なら **数十回の full-game rollout** が可能。

INDEX.md D8「MCTS は将来」を MVP 拡張仕様として確定 (本フェーズで Phase 9-F として正式 spec 化)。

## MVP スコープ (本 phase)

**完全な MCTS (UCB1 tree + selection / expansion / simulation / backprop) は将来拡張とし、
本 phase では「rollout-based 1-ply 評価」で baseline 強度を確保する**:

各 `choose(state, candidates, byPlayer)` 呼び出しで:

1. candidates 各 move について N 回 rollout (default N=10)
2. rollout = move 適用後、`runMatch` で HeuristicPolicy × HeuristicPolicy を gameResult まで実行
3. スコア: byPlayer 勝利=+1 / 敗北=-1 / draw or timeout=0
4. 平均スコア最大の candidate を返却

これは厳密には MCTS ではないが、UCB tree の depth-1 polynomial-time 近似であり、
「1 候補ずつ rollout で expected value 評価」という骨格は同じ。
真の MCTS (tree expansion / UCB1) は **Phase 9-F.2 として deferred**。

## 命名

クラス名は `MCTSPolicy` (将来 tree 拡張する想定の命名一貫性)。
`name: 'mcts-rollout'` (MVP 識別) → Phase 9-F.2 で `'mcts'` に正規化。

## 設計

### 配置

`src/ai/policies/mcts.ts` 新規。`HeuristicPolicy` と同じ pattern (class implements AIPolicy)。

### 既存 API 利用

- `enumerateMoves` (move-enumerator.ts): 既に使用、変更なし
- `applyMove` (policy.ts:211): produce 内で move を state に反映
- `runMatch` (match.ts): rollout の core (HeuristicPolicy × HeuristicPolicy で gameResult まで進む)
- `HeuristicPolicy` (heuristic.ts): rollout policy 兼 optional method fallback

### Optional method 委譲

`chooseGuard / chooseCutIn / chooseDisguise / chooseHiramekiTrigger / chooseMisreadTriggers / chooseSouzaOrder / chooseAtomTarget` は全て内部 `HeuristicPolicy` インスタンスへ delegate (MVP 第 1 版)。
これらを MCTS で評価することは将来拡張。

### Constructor オプション

```ts
interface MCTSPolicyOptions extends RandomPolicyOptions {
  /** 各 candidate 当たりの rollout 回数 (default 10) */
  rollouts?: number;
  /** rollout 内 maxTurns (default 30 — 全 game 平均 9.85 turns の 3 倍を安全マージン) */
  rolloutMaxTurns?: number;
}
```

### choose() アルゴリズム

```
choose(state, candidates, byPlayer):
  if candidates.length === 0: return null
  if candidates.length === 1: return candidates[0]  // 自明
  // endTurn のみ可なら fast path
  if all candidates are endTurn: return candidates[0]

  bestScore = -Infinity
  bestMove = candidates[0]
  for c in candidates:
    s = 0
    for r in 0..rollouts:
      s += simulate(state, c, byPlayer)
    avg = s / rollouts
    if avg > bestScore:
      bestScore = avg
      bestMove = c
  return bestMove
```

### simulate() 関数

```
simulate(state, move, byPlayer):
  // 1. move を produce で apply
  draft = produce(state, d => applyMove(d, move, byPlayer))
  // 2. runMatch で HeuristicPolicy × HeuristicPolicy で gameResult まで
  result = runMatch({ initialState: draft, selfPolicy: HP, oppPolicy: HP, maxTurns: rolloutMaxTurns })
  // 3. スコア
  if result.winner === byPlayer: return +1
  if result.winner === opposite(byPlayer): return -1
  return 0
```

## ルール網羅性チェック

該当無し: AI policy のみで rules/ に影響しない。

## エッジケース列挙

1. **candidates.length === 0** → null 返却 (interface 契約)
2. **candidates.length === 1** → 評価せず即返却 (perf 最適化)
3. **全 candidates が endTurn** → endTurn 即返却 (rollout する意味なし)
4. **move 適用で例外 throw** → catch して score=-1 とする (invariant-fail と同等)
5. **rollout の runMatch が turn-cap で終わる** → draw → score=0
6. **rolloutMaxTurns が小さすぎる** → draw 多発 → 強度低下 (default 30 で十分検証済 baseline avg 9.85)
7. **seed=undefined** → HeuristicPolicy 内部の random 部分が完全乱数化 — 統計学的に妥当

## 水平展開

- `src/ai/policies/index.ts` で `MCTSPolicy` を export
- `scripts/smoke/run-1000.ts` に `--policy=mcts:heuristic` 等のオプション追加 (本 phase は 100 戦で MCTS vs Heuristic 比較のみ)

## 状態完備性

新規 state field 無し (in-memory rollout のみ)。

## 検証

### Unit

- `tests/ai/policies/mcts.test.ts` 新規:
  - 空 candidates → null
  - 単一 candidate → 即返却
  - 全 endTurn → endTurn 返却
  - 複数 candidates → 必ず 1 つを返却
  - move 適用 throw → catch して継続

### Smoke (MCTS vs Heuristic)

- `npx tsx scripts/benchmark/mcts-vs-heuristic.ts` で 100 戦 MCTS-vs-Heuristic ベンチ
- **実測 (rollouts=5)**: MCTS 33% / Heuristic 63% / draws 4 — **HeuristicPolicy の方が強い**
- 原因分析: 5 rollouts × 多数 candidates では rollout 経由のスコア統計ノイズが
  HeuristicPolicy の hand-crafted 判断品質を凌駕できない (variance > signal)
- **本 MVP の結論**: MCTSPolicy class / rollout 基盤 / delegate pattern を投入したが
  AI 強度自体は HeuristicPolicy 未満。strength tuning は Phase 9-F.2 で別途扱う
- 想定する Phase 9-F.2 改善:
  - 真の UCB1 tree (selection / expansion / backprop) で探索効率 ↑
  - 静的評価関数 (LP/AP/証拠/FILE 重み付け線形和) を rollout の代替に利用
  - 並列化 (Web Worker) で rollouts 数を底上げ

### 既存回帰

- `npm run smoke:1000` heuristic × heuristic baseline 525/475 維持
- `npm run benchmark` per-turn ms 維持 (MCTS は smoke では使用しないため影響なし)

## Out of Scope (Phase 9-F.2 候補)

- 真の MCTS tree (UCB1 selection / expansion)
- Optional method (chooseGuard 等) の MCTS 評価
- 並列化 (Web Worker / worker_threads)
- 評価関数チューニング (LP/AP 重み付け)
- 「考えすぎ」防止 (time budget 制御)

## 関連

- Plan: `C:\Users\arumi\.claude\plans\jiggly-watching-lake.md` (Phase 9-F 節)
- Phase 9-H spec: `.claude/specs/phase-9-h-performance.md`
- 関連 D8: `.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md`
