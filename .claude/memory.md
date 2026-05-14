# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: MVP 実装中 (Phase 0-5 完了 = engine 全構築 + 47 カード全実装 + validateAll/smoke)
**最新コミット**: `16801d9 test(cards): Phase 5 validateAll + smoke integration tests`
**テスト状況**: 927 PASS / typecheck 通過

## 次セッション開始時の最優先タスク

⭐ **Phase 6 AI** に着手 — Random / Heuristic CPU driver

詳細プラン: [research/plans/2026-05-11-mvp-implementation/phase-6-ai.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md)

引き続き **subagent-driven** で実行。

## Phase 5 申し送り (Phase 6 で対応)

- **D11019 validator 漏れ**: `src/engine/effect/validate.ts` の `ATOM_VERBS` に `'deckShuffle'` が未登録。
  D11019 が `engine.cards.validate` で error 出力。`tests/cards/validate-all.test.ts` の `KNOWN_FAILING_IDS` で可視化済み。Phase 6 で 1 行追加すれば解消、KNOWN_FAILING_IDS からも削除すること。

## 進捗トラッカー

- [x] Phase 0: ブートストラップ (6 commits)
- [x] Phase 1: 型/RNG/factory/Immer (4 commits)
- [x] Phase 2: read/mutate/invariant (4 commits, 308 tests)
- [x] Phase 3: Effect Resolver + Hooks + Cost + Target + Cond + Dyn (13 commits, 529 tests)
- [x] Phase 4: Flow Control (12 commits, 696 tests)
- [x] Phase 5: cards (23 commits, 927 tests) ✅ 完了
  - [x] 5.1 AbilityDef + cards namespace + TSV loader
  - [x] 5.2 8 共通クラス (cards/_shared/)
  - [x] 5.3-5.5 Partners 4 + Cases 2 + Events 4
  - [x] 5.6 Characters 37 (D08 21 + D11 16)
  - [x] 5.7 validateAll + smoke
- [ ] Phase 6: AI (Random/Heuristic)
- [ ] Phase 7: UI Shell
- [ ] Phase 8: UI Interactions
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 過去セッションログ

- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11](.claude/sessions/2026-05-11.md) — UI 16 + Engine API 初版 + audit
- [2026-05-11-2](.claude/sessions/2026-05-11-2.md) — カード分析 47枚 + TSV 集約
- [2026-05-11-3](.claude/sessions/2026-05-11-3.md) — G23-G30 + 共通クラス + Q&A + MVPプラン
- [2026-05-11-4](.claude/sessions/2026-05-11-4.md) — Phase 0-2 実装
- [2026-05-11-5](.claude/sessions/2026-05-11-5.md) — Phase 3 完了
- [2026-05-12](.claude/sessions/2026-05-12.md) — Phase 4 完了 + Phase 5 完了

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md)
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
