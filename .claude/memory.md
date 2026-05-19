# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Round 4g 完了 ✅ — BUG-030 engine 修正 (continuous modifier resolver 実装)
**最新コミット**: Round 4f `4eb103a` + Round 4g (本セッション commit 待ち)
**テスト状況**: **1464 PASS + 1 skipped** / 192 test files / **E2E 15 pass + 1 skip** (4-layer assert) / smoke **525/475** (1 game shift, avg turns 10.35 → 9.85 positive 変化) / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic / **0 例外 / 0 timeout** / 524/476 baseline 完全維持
**現状**:
- **BUG-006 修正済** (Round 4c): store.dispatch で same-reference 時 shallow copy を強制し ContactFlowDriver useEffect を起動
  - 根本原因: state-machine `advance()` が `contact-pending → judge` (case shortcut) で gameState を一切 mutate せず、Immer produce が同一参照を返し Zustand subscribers が起きなかった
  - 修正範囲: `src/ui/state/store.ts` のみ (UI dispatch wrapper、骨格凍結原則は遵守)
  - 水平展開: action[char] は contact.snapshotAP で必ず mutate あり影響なし、CPU vs CPU 経路も影響なし (smoke baseline 完全維持)
- **@playwright/test 導入** + `tests/e2e/bug-006.spec.ts` + `playwright.config.ts` で React reactivity 込みの実機検証基盤を整備
- engine 3 fix (Round 4a) + 7 hook listener (Round 4b) で機構整備済
- **47 cards triggered ability 個別検証** は次セッション (新 E2E 基盤で実機検証可能に)
- UI 課題 (BUG-001/002/010) は Round 4c+ で対応予定

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI
- [x] Phase 7-8: UI Shell + Phase 8 完全クローズ
- [x] Phase 9-A〜9-E: 1000戦 smoke baseline + engine 4 バグ修正 + UI polish
- [x] **Phase 5 advance engine** (前 session): SceneSwitch / Hirameki / Misread / Souza atom
- [x] **Round 2 UI/UX 修正** (2026-05-18): ユーザ実プレイ後 18 バグ全解消 (commits `e61bb7f` 〜 `d343fde`)
- [x] **Round 3a UI 追加修正** (2026-05-18-2): 12 項目中 9 件解消 (commits `8161efb` + `d15b495`)
  - B3 case-stamp 削除 + edition tag 独立配置 / B6 scrollbar 完全削除 / B9a-b FileArea+modal /
  - B11 grayscale / B12 next-hint engine bug fix / A8 event カード組込 / A1+A10 説明
- [x] **Round 3b UI 追加修正** (2026-05-18-3): B4 LogPanel HandZone パターン化
  - fixed overlay (z=200) + 透明 backdrop layer (z=199) で click-outside-to-close / scrollbar thin / fade-in 260ms / role+aria
- [x] **Round 3c-A UI 追加修正** (2026-05-18-4): B7 part 1 チュートリアル矢印機構 + key 11 step マッピング (commit `f362175`)
  - TutorialHighlight 新規 (border + glow pulse + 矢印 ▼/▲/◀/▶ + createPortal)、TutorialStep.target 拡張、prefers-reduced-motion 追加、text 修正 (END ターン→ターン終了、active/sleep/stun→アクティブ/スリープ/スタン)
- [x] **Round 3c-B UI 追加修正** (2026-05-18-5): B7 part 2 残り 22 step マッピング (14 target + 8 skip) (commit `c8118d0`)
  - 全 33 step Playwright walkthrough: 25 target + 8 skip、全 viewport 内、console error 0、overlay 終了確認
- [x] **Round 4a 重大バグ修正 + RCA + Obsidian Base 導入** (2026-05-18-6): engine 3 fix (BUG-008/009 + 水平展開) + 防止策 spec + Obsidian Bases (commit `e10b3a4`)
  - `.claude/bugs/` 10 ファイル + `index.base` でバグ管理を Obsidian Base 化
  - `.claude/specs/index.base` で spec 最終更新日管理
  - `.claude/specs/card-addition-checklist.md` + `tests/integration/dispatch-to-state.test.ts` 骨格
  - CLAUDE.md §セルフレビュー追記 (Playwright 1試合通し / 管理表更新 / カード追加チェックリスト)
- [x] **Round 4b BUG-005/007 triggered listener 整備** (2026-05-18-7): `src/engine/listeners/triggered.ts` 新規 + 7 hook 配線 + emit kind 分離 (commit `4c64c79`)
- [x] **Round 4c BUG-006 修正 + Playwright E2E 導入** (2026-05-18-8): `src/ui/state/store.ts` で driver reactivity 修正 + `@playwright/test` 基盤 + `tests/e2e/bug-006.spec.ts` (commit `d54e328`)
- [x] **Round 4d Playwright 可視化 + Round 2 18 件履歴移行 + BUG-029 回帰防止** (2026-05-18-9): headed default + BUG-011〜028 + BUG-029 (Round 4c で副次解消) + Vitest/E2E 回帰防止 (commit `f38268c`)
- [x] **Round 4e Phase 1 — E2E helpers 整備 + cutinFixedAP 6 カード** (2026-05-19): tests/e2e/helpers/ 5 ファイル + cutin-fixed-ap.spec.ts 6 カード集約検証、全 pass (commit `cf3380c`)
- [x] **Round 4f Phase 2 — partnerColorKeyword 5 カード E2E + BUG-030 登録** (2026-05-19-2): partner-color-keyword.spec.ts 6 テスト (5+1 negative) 集約検証 (commit `4eb103a`)
- [x] **Round 4g BUG-030 engine 修正** (2026-05-19-3): read.char.keywords に continuous modifier resolver 追加 + unit test 5 + spec 4-layer 拡張、smoke 525/475 positive shift
- [ ] **Round 4h**: caseTraitConditioned 2 カード spec (D11003 / D11005)
- [ ] **Round 4i+**: eventRemoveByAP / hiramekiDraw / hiramekiCharStun
- [ ] **Round 4g**: Partner / 事件 / 固有 effect カード spec
- [ ] **Round 4h+ UI 課題**: BUG-001 拡大表示 / BUG-002 edition tag 隙間 / BUG-010 opp turn 可視化 + 旧 Round 3d B5 観戦モード
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
- [2026-05-18-3](sessions/2026-05-18-3.md) — Round 3b LogPanel HandZone パターン化
- [2026-05-18-4](sessions/2026-05-18-4.md) — Round 3c-A チュートリアル矢印機構
- [2026-05-18-5](sessions/2026-05-18-5.md) — Round 3c-B 全 33 step マッピング + Playwright walkthrough
- [2026-05-18-6](sessions/2026-05-18-6.md) — Round 4a 重大バグ修正 + RCA + Obsidian Base 導入
- [2026-05-18-7](sessions/2026-05-18-7.md) — Round 4b triggered ability listener 整備
- [2026-05-18-8](sessions/2026-05-18-8.md) — Round 4c BUG-006 修正 + Playwright E2E 導入
- [2026-05-18-9](sessions/2026-05-18-9.md) — Round 4d Playwright 可視化 + Round 2 18 件履歴移行 + BUG-029 回帰防止
- [2026-05-19](sessions/2026-05-19.md) — Round 4e Phase 1: E2E helpers + cutinFixedAP 6 カード
- [2026-05-19-2](sessions/2026-05-19-2.md) — Round 4f Phase 2: partnerColorKeyword 5 カード + BUG-030 登録
- **[2026-05-19-3](sessions/2026-05-19-3.md) — Round 4g: BUG-030 engine 修正 (continuous modifier resolver)** (本セッション)
