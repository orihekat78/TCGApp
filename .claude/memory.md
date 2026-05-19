# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Round 4i-fix 完了 ✅ — BUG-032/033 engine 修正 (selfOnly 水平展開 + triggered.ts condition gate)
**最新コミット**: Round 4i-fix (commit hash 取得後置換) — 計 28 連続 commit (Round 2〜4i-fix)
**テスト状況**: 1467 PASS + 1 skipped / 192 files / **E2E 24 pass + 1 skip** / **smoke 525/475 baseline 完全維持** / typecheck clean / docs:check clean
**現状サマリ** (Round 4e-4i-fix):
- Round 4e-4f: E2E helpers 整備 + **cutinFixedAP 6 カード** + **partnerColorKeyword 5 カード** spec 化
- Round 4g: **BUG-030 修正** (engine `read.char.keywords` に continuous modifier resolver、smoke positive shift 525-475)
- Round 4h: **caseTraitConditioned 2 カード** spec + **BUG-031 data fix** (D11021 '婚活' trait 追加)
- Round 4i (`8d35359`): **eventRemoveByAP 2 カード** spec + listener gap 2 件登録 (BUG-032/033)
- Round 4i-fix (本): **BUG-032/033 engine 修正** — `eventRemoveByAP` factory + D11019/D11020/D08024 a1 に `selfOnly:true` 水平展開、`selfOnlyMatches` hand 経路 player check 追加、`handleHook` に condition gate (`evalCond`) 追加。unit +3 / E2E +1 / smoke 完全維持
- 共通パターン spec 進捗: **4/5 完了**、残 hiramekiDraw / hiramekiCharStun
- BUG-XXX 管理: BUG-001〜033 計 33 件、**修正済 31 件 + 未着手 UI 系のみ** (BUG-032/033 が今回 修正済 化)

## 進捗トラッカー (高レベル)

- [x] **Phase 0-9-E**: engine + 47 カード + AI + UI Shell + smoke baseline + engine 4 バグ修正 (詳細は session log 参照)
- [x] **Phase 5 advance engine**: SceneSwitch / Hirameki / Misread / Souza atom
- [x] **Round 2-3 UI/UX 修正** (2026-05-18 / 18 件 + B4/B7): commits `e61bb7f` 〜 `c8118d0`
- [x] **Round 4a-b 機構整備** (2026-05-18-6/7): engine 3 fix + Obsidian Base + triggered listener (commits `e10b3a4` / `4c64c79`)
- [x] **Round 4c-d UI reactivity 修正 + Playwright 基盤** (2026-05-18-8/9): BUG-006 修正 + @playwright/test + headed default + Round 2 18 件 BUG-XXX 移行 (`d54e328` / `f38268c`)
- [x] **Round 4e-i-fix 47 カード E2E + engine 修正 (4/5 共通パターン完了)** (2026-05-19〜2026-05-20):
  - 4e (`cf3380c`): E2E helpers + cutinFixedAP 6 カード
  - 4f (`4eb103a`): partnerColorKeyword 5 カード + BUG-030 登録
  - 4g (`3932d04`): BUG-030 修正 (continuous modifier resolver) + smoke positive shift
  - 4h (`08621c0`): caseTraitConditioned 2 カード + BUG-031 data fix
  - 4i (`8d35359`): eventRemoveByAP 2 カード + BUG-032/033 listener gap 検出
  - 4i-fix (本): BUG-032/033 engine 修正 (selfOnly 水平展開 + handleHook condition gate)
- [ ] **Round 4j**: hiramekiDraw 2 カード (D08013 / D08024)
- [ ] **Round 4k**: hiramekiCharStun 2 カード (D08019 / D11009)
- [ ] **Round 4l+ UI 課題**: BUG-001 拡大表示 / BUG-002 edition tag / BUG-010 opp turn 可視化 / B5 観戦モード
- [ ] **Phase 5 advance UI** 残: Misread UI / Souza Sub-task B+C
- [ ] Phase 9-F (MCTS) / 9-G (リプレイ) / 9-H (パフォーマンス計測)
- [ ] **origin/main push** (本セッション末で sync)

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
- [2026-05-19-3](sessions/2026-05-19-3.md) — Round 4g: BUG-030 engine 修正 (continuous modifier resolver)
- [2026-05-19-4](sessions/2026-05-19-4.md) — Round 4h: caseTraitConditioned 2 カード + BUG-031 data fix
- [2026-05-20](sessions/2026-05-20.md) — Round 4i: eventRemoveByAP 2 カード + BUG-032/033 listener gap 登録
- **[2026-05-20-2](sessions/2026-05-20-2.md) — Round 4i-fix: BUG-032/033 engine 修正** (本セッション)
