# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: MVP 実装中 (Phase 0-6 完了 = engine + 47 カード + AI Random/Heuristic + AI vs AI 100戦 smoke)
**最新コミット**: `dfbe16d test(integration): AI vs AI 100 matches smoke + heuristic comparison`
**テスト状況**: 991 PASS / typecheck 通過 / 100戦 0 invariant failure

## 2026-05-14 (Session 2): Obsidian × Engine 統合 完了 ✅

エンジン本体無変更で `.claude/auto/` に 25 ファイル自動生成（api 13 + state 1 + flows 4 + progress 2 + mapping 5）。`npm run docs:check` を pre-commit に配線。詳細: [sessions/2026-05-14-2](.claude/sessions/2026-05-14-2.md)

## 次セッション開始時の最優先タスク

⭐ **Phase 7 UI Shell** に着手 — プレイマット + selectors

詳細プラン: [research/plans/2026-05-11-mvp-implementation/phase-7-ui-shell.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-7-ui-shell.md)

引き続き **subagent-driven** で実行。

## Phase 6 申し送り (Phase 7+ で対応)

1. **Heuristic policy 改善**: handUseCard を reasoning より優先する priority 見直し (Random vs Heuristic 20戦で Heuristic 0勝の原因)
2. **assist trigger 厳格化**: 現状 FILE=6 で無条件 → `evidence >= required - 2` 条件追加推奨
3. **endTurn turnFlags reset**: match.ts が手動で `mutate.flag.resetTurnFlags` を呼ぶ。endTurn 内自動化検討余地
4. **100戦結果**: evidence勝 22 / turn-cap 78 (maxTurns=50)。Heuristic 改善で勝率改善見込み

## Phase 5 fix 履歴 (このセッション)

- `115d051` D11019 validator 漏れ修正: `src/engine/effect/validate.ts` ATOM_VERBS に 'deckShuffle' 追加 + `KNOWN_FAILING_IDS` 空化 → 47/47 全カード validate 成功

## Phase 7 申し送り (UI 着手時に参照)

- `design-mockups/01-board-mockup.html` のレイアウトを **as-is 採用** (Task 7.3 Playmat レイアウトの基準)
- `design-mockups/` 内 ②③④ (02a/02b/03/04) は **採否未決**。Phase 7 着手時に各 task で個別判断
- 詳細: [phase-7-ui-shell.md](.claude/research/plans/2026-05-11-mvp-implementation/phase-7-ui-shell.md) 冒頭「レイアウト参照資産」セクション参照

## 進捗トラッカー

- [x] Phase 0: ブートストラップ (6 commits)
- [x] Phase 1: 型/RNG/factory/Immer (4 commits)
- [x] Phase 2: read/mutate/invariant (4 commits, 308 tests)
- [x] Phase 3: Effect Resolver + Hooks + Cost + Target + Cond + Dyn (13 commits, 529 tests)
- [x] Phase 4: Flow Control (12 commits, 696 tests)
- [x] Phase 5: cards (24 commits, 927 tests) ✅ 完了
  - [x] 5.1 AbilityDef + cards namespace + TSV loader
  - [x] 5.2 8 共通クラス (cards/_shared/)
  - [x] 5.3-5.5 Partners 4 + Cases 2 + Events 4
  - [x] 5.6 Characters 37 (D08 21 + D11 16)
  - [x] 5.7 validateAll + smoke
- [x] Phase 6: AI (7 commits, 991 tests) ✅ 完了
  - [x] 6.1-6.2 move-enumerator + AIPolicy/playTurn
  - [x] 6.3-6.4 RandomPolicy + HeuristicPolicy
  - [x] 6.5-6.6 match driver + AI vs AI 100戦 smoke (0 invariant failure)
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
- [2026-05-14](.claude/sessions/2026-05-14.md) — Phase 5 fix (D11019) + Phase 6 完了
- [2026-05-14-2](.claude/sessions/2026-05-14-2.md) — Obsidian × Engine 統合 (meta-tooling)
- [2026-05-14](.claude/sessions/2026-05-14.md) — Phase 5 fix (D11019) + Phase 6 完了

## 主要参照

- [.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md)
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
