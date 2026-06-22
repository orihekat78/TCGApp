## refactor(engine): Phase 3f — engine applyMove exhaustiveness ガード (default:never)

AI 層 `applyMove` (src/ai/policy.ts:209) の `switch (move.kind)` 末尾に `default:never` 網羅性ガードを追加
(挙動完全不変・additive/compile-time-only)。3e の水平展開で発見した engine 層 silent-gap を、骨格 touch ゆえ別 phase で実施。

- `applyMove` (void) の switch 末尾 (endTurn case の後) に inline
  `const _exhaustive: never = move; void _exhaustive; return;` を追加。Move union 11 member 全網羅ゆえ
  default は到達不能 → runtime 完全不変。`noImplicitReturns` 不在で member 脱落が silent fall-through する穴を compile error 化。
- **throw 不使用**: 呼出 4 site のうち policy.ts:412 (`produce(...)` 内) が try 外。throw だと将来到達可能化した際に
  uncaught 例外が stepTurn を貫通し挙動破壊するため void 変種で統一 (Phase 3e と同判断、mcts/mcts-tree/replay の他 3 site は try 内)。
- **着手前設計レビュー** (Workflow opus 3 lens + synthesis、367k tok、BLOCKER 0、GO): behavior-invariance / 骨格凍結
  admissibility = ADOPT-AS-IS (例外(3)「動作不変な内部最適化」に該当、3e と対称)、completeness = ADOPT-WITH-CHANGES。
- **水平展開**: engine+ai の switch 23 件を走査。applyMove 以外の唯一の未ガード exhaustive switch =
  `resolve-picks.ts:431` (effect.kind/Effect union、`case 'chain'` 欠落で top-level chain を silent passthrough)。
  別 logic 課題ゆえ **Phase 3g** に切出し ([BUG-152](.claude/bugs/BUG-152.md))。
- 検証 GREEN: tsc0 (両 tsconfig) + 負テスト (reasoning case 削除→TS2322@policy.ts(280,13)) / vitest 2783+1skip /
  smoke winsA=498 / e2e 26 (初回 fail は並走 contention flake、再走 green) / eslint 125 (added0) / 規約 lint 8 本 errors=0 /
  numstat 8add/0del (additive-only)。
