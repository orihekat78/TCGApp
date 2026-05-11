# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: MVP 実装中 (Phase 0-4 完了 + Phase 5 部分完了 = engine 全構築 + cards/_shared/ 8共通クラス + Partners 4 / Cases 2 / Events 4 実装)
**最新コミット**: `c40dcdd feat(cards): registerAll + cross-set registry test`
**テスト状況**: 816 PASS / typecheck 通過

## 次セッション開始時の最優先タスク

⭐ **Phase 5 Group D-F** から再開 — 残り 37 characters + validateAll smoke

詳細プラン: [research/plans/2026-05-11-mvp-implementation/phase-5-cards.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-5-cards.md)

引き続き **subagent-driven** で実行。

## 進捗トラッカー

- [x] Phase 0: ブートストラップ (6 commits)
- [x] Phase 1: 型/RNG/factory/Immer (4 commits)
- [x] Phase 2: read/mutate/invariant (4 commits, 308 tests)
- [x] Phase 3: Effect Resolver + Hooks + Cost + Target + Cond + Dyn (13 commits, 529 tests)
- [x] Phase 4: Flow Control (12 commits, 696 tests)
- [ ] Phase 5: cards (進行中 — A/B/C 完了 = 10 commits 816 tests、Group D-F 残)
  - [x] 5.1 AbilityDef + cards namespace + TSV loader
  - [x] 5.2 8 共通クラス (cards/_shared/)
  - [x] 5.3-5.5 Partners 4 + Cases 2 + Events 4
  - [ ] 5.6 Characters 22 unique (D08 + D11)
  - [ ] 5.7 validateAll + smoke
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
- [2026-05-12](.claude/sessions/2026-05-12.md) — Phase 4 完了 + Phase 5 開始 (A/B/C 完了)

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md)
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
