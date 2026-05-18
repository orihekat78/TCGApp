# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Round 2 UI/UX 修正 完了 ✅ — ユーザ報告 **18 バグすべて解消** (100%)
**最新コミット**: `664906c` (feat(ui): Round 2 Batch 3b — FILE/証拠/リムーブ エリアクリック モーダル B-9) — local main
**テスト状況**: 1436 PASS / 189 test files / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic / 3.x s / **0 例外 / 0 timeout** / A 52.4% vs B 47.6% / baseline 完全維持 (Round 2 全 6 commit で regression 0)
**ブラウザ表示**: 人間 vs CPU エンドツーエンド動作確認済 (引き直し UI / picker glow / FILE/証拠/リムーブ モーダル / ログ閉じる / チュートリアル 33 step)

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI
- [x] Phase 7-8: UI Shell + Phase 8 完全クローズ
- [x] Phase 9-A〜9-E: 1000戦 smoke baseline + engine 4 バグ修正 + UI polish
- [x] **Phase 5 advance engine** (前 session): SceneSwitch / Hirameki / Misread / Souza atom
- [x] **Round 2 UI/UX 修正** (2026-05-18): ユーザ実プレイ後 18 バグ全解消
  - Batch 1-A: 8 バグ (startTurn / TopBar / UID / アシスト警告 / 引き直し UI) — `e61bb7f`
  - Batch 1-B: 手札 disabled 可視化 / picker glow / picker stack — `c09807e`
  - Batch 1.5: チュートリアル「次へ」修正 — `269eccc`
  - Batch 2: 視覚クイック修正 (5 件) — `07e47a1`
  - Batch 3a: ログ閉じる + 日本語化 — `5e91bbe`
  - Batch 3b: FILE/証拠/リムーブ モーダル — `664906c`
- [ ] **Phase 5 advance UI** 残: Misread UI / Souza Sub-task B+C
- [ ] Phase 9-F (MCTS) / 9-G (リプレイ) / 9-H (パフォーマンス計測)

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) etc — Phase 7 / 8 系
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成
- [2026-05-17-2](sessions/2026-05-17-2.md) — Phase 9-A〜9-E 一気通貫
- [2026-05-17-3](sessions/2026-05-17-3.md) — Phase 5 advance prep + C+D + React fix
- [2026-05-17-4](sessions/2026-05-17-4.md) — Phase 5 advance engine 4 sub-feature 達成
- **[2026-05-18](sessions/2026-05-18.md) — Round 2 UI/UX 修正: 18 バグ全解消** (本セッション)
