# 実装保留 (Deferred) 一覧

本ファイルは「実装はあるが未完成 or 未着手で先送りされた」項目の集約 INDEX。
新規 defer を生んだ commit / session log は必ずここに 1 行追加すること。

## 公式 defer 宣言済 (専用ファイルあり)

| Phase | 内容 | 専用 spec |
|-------|------|----------|
| Phase 5 advance | Souza Sub-task B / C | `phase-5-advance-souza-deferred.md` |
| Phase 9-F.2 | MCTS policy 強化 | `src/ai/policies/mcts.ts:10` コメント |

## Round/Phase 単位の繰越 (memory / session log 経由)

| 繰越元 | 内容 | 状況 |
|--------|------|------|
| Cleanup Phase 中/大規模 #1 | 動的式評価括弧 | `src/engine/dyn/eval.ts:13,145` TODO Phase 5 |
| Cleanup Phase 中/大規模 #2 | AI コスト選択ロジック拡張 | undocumented (S148 session log のみ) |
| Cleanup Phase 中/大規模 #3 | AI ヒューリスティック「有用カード操作」(大) | undocumented |
| Cleanup Phase 中/大規模 #6 | Playmat レスポンシブレイアウト | undocumented |
| Cleanup Phase 中/大規模 #9 | 触発 listener 漏れ | undocumented |
| BUG-006 | GuardPickerModal が active 状況で開かず E2E skipped | `tests/e2e/bug-006.spec.ts` skip 継続 |
| BUG-036 | refresh ok:false 時 gameResult 未配線 | ✅ 修正済 (`1480465` / 2026-05-22) |

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

## カード実装 defer (engine ゲート起因)

| 起因 | 内容 | 状況 |
|------|------|------|
| 2026-06-04 pilot | catalog-reuse「reusable 306」は過大評価。最易30枚中 実装可2枚のみ。残はevent→evidence/leave・reasoning hook無/continuous他者buff/手札数condition/カットインfilter等の engine ゲート | ゲート一覧: [card-impl-engine-gates.md](card-impl-engine-gates.md)。reusable+unclassified の **engine-gate 再分類** が必要 |
| 2026-06-04 pilot | workflow harness: schema 付き subagent が StructuredOutput 未呼びで 0-token 即終了 (30/30 fail) | 量産 harness として要調査。pilot 2枚は手実装で代替 |

## 運用

- 新規 defer が発生したら本ファイルに追加 + 該当 BUG-XXX.md または spec doc に
  リンク
- 月次 cleanup phase で本リストを見て解消可能項目を洗い出す
- `.claude/auto/` の mapping/state docs と整合性確認は手動 (auto-gen 対象外)
