# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 5 advance engine 4 sub-feature 達成 ✅ (SceneSwitch / Hirameki / Misread / Souza)
**最新コミット**: `59183f4` (feat(engine,ai): Phase 5 advance — Souza (rules/13 捜査X) engine atom + AI auto-order) — origin/main 同期済
**テスト状況**: 1434 PASS / 189 test files / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic / 3.x s / **0 例外 / 0 timeout** / A 52.4% vs B 47.6% / 平均 10.35 ターン (baseline 完全維持、5 連続 commit で regression 0)
**ブラウザ表示**: 人間 vs CPU エンドツーエンド動作 + SceneSwitch UI 配線 (modal/pick/cancel) + Hirameki UI 既存配線

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI
- [x] Phase 7-8: UI Shell + Phase 8 完全クローズ
- [x] Phase 9-A〜9-E: 1000戦 smoke baseline + engine 4 バグ修正 + UI polish
- [x] **Phase 5 advance prep**: guardrails spec 起草 (`5cdc3bb`)
- [x] **Phase 5 advance: SceneSwitch (engine+AI+UI)**: `6625283` / `1421772`
- [x] **Phase 5 advance: Hirameki E2E + bug fix**: `75fe5f4` (listener `_resetHiramekiRegistered` 追加)
- [x] **Phase 5 advance: Misread E2E (Human defender) + bug fix**: `9070556` (同種 listener fix)
- [x] **Phase 5 advance: Souza engine atom + AI auto-order**: `59183f4`
- [x] **C+D scope-out / React 19 Expected static flag / demo path 検証** (`616272c` / `e79c0d0` / `321f4f2`)
- [ ] Phase 5 advance: Misread UI / Souza Sub-task B/C / 「発見された」参照機構
- [ ] Phase 9-F (MCTS) / 9-G (リプレイ) / 9-H (パフォーマンス計測)

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) etc — Phase 7 / 8 系
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成
- [2026-05-17-2](sessions/2026-05-17-2.md) — Phase 9-A〜9-E 一気通貫
- [2026-05-17-3](sessions/2026-05-17-3.md) — Phase 5 advance prep + C+D + React fix
- [2026-05-17-4](sessions/2026-05-17-4.md) — Phase 5 advance engine 4 sub-feature 達成 (9 commits)

## 次セッション

- [NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md) — 次セッション開始用 (現状: engine 完了、UI 統合 + Phase 9 候補)
