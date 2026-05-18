# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Round 3b LogPanel HandZone パターン化 完了 ✅ (Round 3 全 12 項目中 10 件解消、B5/B7 残)
**最新コミット**: Round 3b commit 直前 (実装 + test + session log 完了、commit 待ち) — local main
**テスト状況**: 1440 PASS + 1 skipped / 189 test files / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic / 3.4 s / **0 例外 / 0 timeout** / 524/476 baseline 完全維持 (Round 2+3a+3b 全 10 commit で regression 0)
**ブラウザ表示**: 人間 vs CPU エンドツーエンド + Round 3a 視覚 + Round 3b LogPanel fixed overlay / backdrop click 閉 / scrollbar thin / fade-in

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI
- [x] Phase 7-8: UI Shell + Phase 8 完全クローズ
- [x] Phase 9-A〜9-E: 1000戦 smoke baseline + engine 4 バグ修正 + UI polish
- [x] **Phase 5 advance engine** (前 session): SceneSwitch / Hirameki / Misread / Souza atom
- [x] **Round 2 UI/UX 修正** (2026-05-18): ユーザ実プレイ後 18 バグ全解消 (commits `e61bb7f` 〜 `d343fde`)
- [x] **Round 3a UI 追加修正** (2026-05-18-2): 12 項目中 9 件解消 (commits `8161efb` + `d15b495`)
  - B3 case-stamp 削除 + edition tag 独立配置 / B6 scrollbar 完全削除 / B9a-b FileArea+modal /
  - B11 grayscale / B12 next-hint engine bug fix / A8 event カード組込 / A1+A10 説明
- [x] **Round 3b UI 追加修正** (2026-05-18-3): B4 LogPanel HandZone パターン化 (本セッション)
  - fixed overlay (z=200) + 透明 backdrop layer (z=199) で click-outside-to-close / scrollbar thin / fade-in 260ms / role+aria
- [ ] **Round 3c**: B7 チュートリアル矢印/吹き出し (規模大)
- [ ] **Round 3d**: B5 CPU-vs-CPU 観戦モード (規模中)
- [ ] **Phase 5 advance UI** 残: Misread UI / Souza Sub-task B+C
- [ ] Phase 9-F (MCTS) / 9-G (リプレイ) / 9-H (パフォーマンス計測)
- [ ] Round 2+3 全 commits の origin/main push (現在 local main のみ)

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) etc — Phase 7 / 8 系
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成
- [2026-05-17-2](sessions/2026-05-17-2.md) — Phase 9-A〜9-E 一気通貫
- [2026-05-17-3](sessions/2026-05-17-3.md) — Phase 5 advance prep + C+D + React fix
- [2026-05-17-4](sessions/2026-05-17-4.md) — Phase 5 advance engine 4 sub-feature 達成
- [2026-05-18](sessions/2026-05-18.md) — Round 2 UI/UX 修正: 18 バグ全解消
- [2026-05-18-2](sessions/2026-05-18-2.md) — Round 3a UI 追加修正: 9/12 解消
- **[2026-05-18-3](sessions/2026-05-18-3.md) — Round 3b LogPanel HandZone パターン化** (本セッション)
