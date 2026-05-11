# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: MVP 実装中 (Phase 0-4 完了 = engine 完全構築: types/read/mutate/invariant + event/effect/dyn/target/cost/cond/resolve + flow setup/auto/main/action-SM/contact/actionCase/guard + target-expander)
**最新コミット**: `0ac99ac fix(engine): remove dead canActionAgainstChar fallback + tighten integration test invariants`
**テスト状況**: 696 PASS / 56 Test Files / typecheck 通過

## 次セッション開始時の最優先タスク

⭐ **Phase 5 (cards/_shared/ 9 + 47 cards CT-D08 + CT-D11)** から再開

詳細プラン: [research/plans/2026-05-11-mvp-implementation/phase-5-cards.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-5-cards.md)

骨格凍結原則の本領発揮フェーズ — Phase 5 では engine 修正なしで全カード実装する。
引き続き **subagent-driven** で実行。

## 進捗トラッカー

- [x] Phase 0: ブートストラップ (6 commits)
- [x] Phase 1: 型/RNG/factory/Immer (4 commits)
- [x] Phase 2: read/mutate/invariant (4 commits, 308 tests)
- [x] Phase 3: Effect Resolver + Hooks + Cost + Target + Cond + Dyn (13 commits, 529 tests)
- [x] Phase 4: Flow Control (turn/auto/main/action-SM/contact/actionCase/guard) (12 commits, 696 tests)
- [ ] Phase 5: cards/_shared/ 9 + 47 cards
- [ ] Phase 6: AI (Random/Heuristic)
- [ ] Phase 7: UI Shell
- [ ] Phase 8: UI Interactions
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 過去セッションログ

- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11 (午前+昼)](.claude/sessions/2026-05-11.md) — UI 16 + Engine API 初版 + audit
- [2026-05-11-2](.claude/sessions/2026-05-11-2.md) — カード分析 47枚 + TSV 集約
- [2026-05-11-3](.claude/sessions/2026-05-11-3.md) — G23-G30 + 共通クラス + Q&A + MVPプラン
- [2026-05-11-4](.claude/sessions/2026-05-11-4.md) — subagent-driven 実装 Phase 0-2
- [2026-05-11-5](.claude/sessions/2026-05-11-5.md) — subagent-driven 実装 Phase 3 完了
- [2026-05-12](.claude/sessions/2026-05-12.md) — subagent-driven 実装 Phase 4 完了

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md) — MVP 実装プラン
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md) — 全 spec
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
