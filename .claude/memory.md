# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 9-B クローズ達成 ✅ engine 4 バグ修正 + AI チューニングで smoke が決着
**最新コミット**: `0adf3a4` (chore(smoke): post-engine-fix 1000-game report) → C5 (docs) 進行中
**テスト状況**: 1394 PASS / 184 test files / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic 1000戦 / 3.4s / **0 例外 / 0 timeout** / A 52.4% vs B 47.6% / 平均 10.35 ターン
**ブラウザ表示**: 人間 vs CPU エンドツーエンド動作 (engine fix で内部挙動改善、UI 視点は不変)

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] Phase 7 + 7.5: UI Shell + layout pivot
- [x] Phase 8.1-8.10: hooks 基盤 / 推理 / アクション / アシスト / 事件解決 / 手札 / 演出 / チュートリアル
- [x] **Phase 8 完全クローズ Commit 1〜6** ✅ — [sessions/2026-05-17](sessions/2026-05-17.md)
   - Commit 1 (`eb21e8c`): GuardPicker/CutInDisguisePicker UI
   - Commit 2 (`770624e`): per-step action dispatch + ContactFlowDriver
   - Commit 2.5 (`62fa8b2`): playTurn pauseOnAction + useOppTurnDriver per-step
   - Commit 3a (`5d1620d`): Hirameki end-to-end
   - Commit 3b (`b50571a`): Misread infrastructure (Phase 5 prep)
   - Commit 4 (`3360006`): Souza/SceneSwitch modal scaffolds (Phase 5 prep)
   - Commit 5 (`60be8b4`): 効果スタック reorder UI
   - Commit 6 (`135a12b`): human-vs-CPU E2E
- [x] **Phase 9-A**: 1000戦 smoke ベースライン取得 — [reports/smoke-2026-05-17](reports/smoke-2026-05-17.md)
   - C1 (`e4878ba`): aggregate / format-md pure + tests (+15)
   - C2 (`e540f38`): run-1000.ts runner + smoke:1000 script
   - C2.5 (`0f3fc73`): anomaly Markdown 表示上限 20 件
   - C3 (`afd9d17`): 初回レポート (1000戦 / 20.6s / 0 例外 / 100% turn-cap)
- [x] **Phase 9-B**: Engine 整合性修正 + Heuristic チューニング — [reports/smoke-2026-05-17-phase9b](reports/smoke-2026-05-17-phase9b.md)
   - C2 (`8490fd0`): B1 — endTurn で `clearNamed` 呼出、名乗り状態を rules/11 通りにクリア
   - C3 (`7b9984d`): B2 + B3 — handUseCard でキャラを scene.enter、AI が cost picker indices を populate
   - C3.5 (`a0d4c1c`): B4 — Heuristic NextHint gate (fileLen>=8) + テスト更新
   - C4 (`0adf3a4`): 修正後レポート (1000戦 / 3.4s / 0 例外 / 0 timeout / A 52.4% vs B 47.6%)
- [ ] Phase 5 prep の engine 統合 (実カード追加と同時)
- [ ] Phase 9-C 以降: リプレイ / カード追加 / パフォーマンス

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) / [-2](sessions/2026-05-15-2.md) / [-3](sessions/2026-05-15-3.md)
- [-5](sessions/2026-05-15-5.md) / [-6](sessions/2026-05-15-6.md) / [-7](sessions/2026-05-15-7.md) / [-8](sessions/2026-05-15-8.md)
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成

## 次セッション

- [NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md) — 次セッション開始用コピペプロンプト
- Phase 9 候補から brainstorming で 1 つ選んで開始
