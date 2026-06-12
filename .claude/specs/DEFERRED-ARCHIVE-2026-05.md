# Deferred アーカイブ (2026-05 時点スナップショット)

[DEFERRED-INDEX.md](DEFERRED-INDEX.md) の 100 行制限超過に伴い分割した歴史スナップショット
(2026-06-12 分割)。live な defer は INDEX 側を見ること。

## コード TODO grep 結果 (2026-05-21)

| ファイル | 行 | 内容 |
|---------|----|----|
| `src/ai/policies/mcts.ts` | 10 | Phase 9-F.2 (deferred) |
| `src/engine/effect/resolver.ts` | 17, 37 | Phase 4+ で並列セマンティクス検討 |
| `src/engine/flow/setup.ts` | 14 | engine.rng singleton 化検討 |
| `src/engine/flow/setup.ts` | 200 | PlayerState.faceUp when UI requires reveal() |
| `src/engine/flow/action/state-machine.ts` | 44 | Phase 5: パートナー AP 修正効果対応 |
| `src/engine/dyn/eval.ts` | 13, 145, 215 | Phase 5: 括弧 / turnEffect integration |
| `src/engine/cards/tsv-loader.ts` | 70, 78, 148 | Phase 5: 『 』/ ( ) 分割、caseTraits 推定 |
| `src/engine/listeners/misread.ts` | 121 | Phase 5: reasoning:end の cleanup listener |
| `src/cards/ct-d11/D11005.ts` | 19 | Phase 5+: source uid 伝播 |
| `src/cards/ct-d11/D11007.ts` | 13 | Phase 5+: action canActionAgainstChar selectorPatch |
| `src/engine/cost/pay.ts` | 8 | Phase 3.10: viaCost wire |

## user_request 20260521_01 由来 (本 plan 由来の繰越候補)

| user_request # | 内容 | BUG ID 候補 |
|---------------|------|------------|
| #18 (umbrella) | カード個別実装が機能していない | BUG-043 (audit umbrella) |
