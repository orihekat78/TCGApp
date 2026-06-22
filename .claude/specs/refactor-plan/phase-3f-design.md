# Phase 3f 設計 — engine applyMove exhaustiveness ガード (2026-06-22、着手前設計レビュー反映済)

挙動完全不変 (骨格凍結の「動作不変な内部最適化」例外)。本 phase は **additive (compile-time-only)**。
3e の水平展開で発見した engine 層 silent-gap を、骨格 touch ゆえ **別 phase** として実施。
着手前設計レビュー (Workflow opus 3 lens + synthesis、367k tok、**BLOCKER 0**、**GO**)。

## 対象

`src/ai/policy.ts` の `applyMove(state, move, byPlayer): void` — `switch (move.kind)` を 11 case で分岐
(Move union = `src/ai/move-enumerator.ts:23-34` の 11 member)、全 case `return;`、**default 0 件**。
tsconfig は `noFallthroughCasesInSwitch` 有・**`noImplicitReturns` 無** → 将来 Move に member 追加で case を
書き忘れると tsc 無警告で switch 素通り (silent fall-through)。3e の UI 2 switch と完全同型の bug class。

## 実装 (void 変種・helper 不使用)

`case 'endTurn'` の後・switch `}` 直前に挿入:
```ts
    default: {
      const _exhaustive: never = move;
      void _exhaustive;
      return;
    }
```
- **throw ではなく void 変種** (MAJOR): applyMove の呼出 **4 site** のうち `policy.ts:412`
  (`produce(state, draft => applyMove(...))`) は **try 外**。throw 変種だと将来 member 脱落で default が
  到達可能化した瞬間、uncaught 例外が stepTurn を貫通し挙動破壊。他 3 site (mcts-tree.ts:157 / mcts.ts:104 /
  useReplayDriver.ts:52) は try 内だが、policy.ts:412 が try 外ゆえ void で統一。Phase 3e と同判断。
  (レビューで brief の「呼出 1 site」記述を 4 site に訂正済 — void 選択をむしろ補強する。)
- repo 既存 8 サイト全インライン (`assertNever` 0 件)。void 変種は cost/pay.ts:195・useEngineDispatch.ts:348 と同型。

## 設計レビュー判定 (opus 3 lens + synthesis)

| lens | verdict | 要点 |
|------|---------|------|
| behavior-invariance (敵対) | ADOPT-AS-IS | 実際に適用→tsc0/eslint0/policy.test 13-13、負テスト TS2322 を実証→revert clean。11/11 網羅・全 Move は literal kind 構築・4 call site に unsafe cast 0 ゆえ default 到達不能=runtime 完全不変 |
| 骨格凍結 admissibility | ADOPT-AS-IS | 例外(3)「動作不変な内部最適化」に該当 (3e と対称分類)。骨格バグ修正(b)ではない (現状 11/11 網羅で実バグ無し、予防的)。scope minimal (family型化/applyMove分割は 3e 同様不要)。UI(3e) と engine(3f) を別 commit にするのは 1phase=1commit と整合 |
| 水平展開 completeness | ADOPT-WITH-CHANGES | engine+ai の switch 23 件を走査。applyMove 以外の唯一の未ガード exhaustive switch = **resolve-picks.ts:431** (effect.kind/Effect union)。別 logic 課題ゆえ **Phase 3g** に切出し (fold せず) |

## 挙動不変ゲート (全 GREEN)

tsc **0** (両 tsconfig) / **負テスト** (reasoning case 削除→`TS2322 at policy.ts(280,13)`→復元、commit せず) /
vitest **2783+1skip** (baseline 一致) / smoke:1000 **winsA=498** (baseline check OK・timeouts0/exceptions0) /
e2e 3spec **26** (初回 1fail は vitest+smoke 並走の CPU contention flake、単体+クリーン再走で 26 green) /
eslint **125** (added0、`_exhaustive` は varsIgnorePattern `^_` 免除・default `{}` で no-case-declarations 不発火) /
規約 lint 8 本 errors=0 / numstat **8add/0del** (追加=default ブロック+rationale コメントのみ)。

## 水平展開 → Phase 3g (新設) / BUG-152

`src/engine/effect/resolve-picks.ts:431` の `switch (effect.kind)` は Effect union (11 member) を分岐するが
`case 'chain'` を **持たず** (atom/sequence/parallel/choice/optional/conditional/forEach/replace/negate/custom のみ)、
`default: return effect` (L562) で未処理 kind を **silent passthrough**。guarded sibling の resolver.ts:78 は chain を handle。
→ top-level chain effect が default に落ち **un-walked** ($pick 未置換の可能性)。**構造非対称は機械確認済・runtime 影響は未確認**。
→ **Phase 3g**: chain step の resolveEffectPicks 再入有無を確認 → 実害あれば `case 'chain'` 追加 → default を never 化
(negate/custom も明示 case 化要)。applyMove と違い default が reachable passthrough ゆえ **real-logic 課題** (機械 guard 挿入ではない)。
詳細は [BUG-152](../../bugs/BUG-152.md)。
