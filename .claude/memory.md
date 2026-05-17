# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 9-E クローズ達成 ✅ (9-A〜9-E 一気通貫 / Phase 9 polish 完了)
**最新コミット**: `76681f6` (feat(ui): low-stock deck warn + progress-7 complete + opp hand back unify) — origin/main 同期済
**テスト状況**: 1399 PASS / 185 test files / typecheck clean / docs:check clean
**1000戦 smoke**: heuristic × heuristic / 3.4s / **0 例外 / 0 timeout** / A 52.4% vs B 47.6% / 平均 10.35 ターン
**ブラウザ表示**: 人間 vs CPU エンドツーエンド動作 + 表向きカード画像 / 事件向き自動判定 / 裏向きエリア視覚 polish 済

## 進捗トラッカー (高レベル)

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] Phase 7 + 7.5 + 8.1〜8.10: UI Shell + actions / chuto / etc
- [x] Phase 8 完全クローズ Commit 1〜6 — [sessions/2026-05-17](sessions/2026-05-17.md)
- [x] **Phase 9-A**: 1000戦 smoke baseline
- [x] **Phase 9-B**: engine 4 バグ修正 (clearNamed / handUseCard char deploy / AI cost picker / NextHint gate) + hotfix (node:fs → browser 分離)
- [x] **Phase 9-C**: カード画像 UI 統合 (CardArt + useCardImage)
- [x] **Phase 9-D**: case 向き自動判定 / partner 拡大 / hand 色あせ修正 / Remove 画像 / Evidence↔FILE swap
- [x] **Phase 9-E**: deck low-stock 警告 / progress-7 完了ハイライト / opp 手札 mini back 統一
- [x] **Phase 5 advance prep**: [guardrails spec](specs/2026-05-17-phase5-advance-guardrails.md) 起草 (9-B 4件再発防止: ルール行CL / AI同期PR / smoke dump / listenerテンプレ)
- [x] **C+D scope-out**: sampleGameState cardId 正規化 (D-prefix) + HandZone key 一意化 + cardResolvers idx key cardNum 化 (pre-existing registry mismatch)
- [x] **React Internal error "Expected static flag" 解消**: CaseArea の `useCardOrientation` を early-return より前に移動 (Rules of Hooks 違反 fix)
- [x] **demo path 検証**: 「デモ (turn-4) を読込」経路で 17 CardArt 全 CDN 取得 + name/cost 表示 + console clean を Playwright 確認 (実装不要、C 拡張 + React fix の累積で自然解消)
- [x] **Phase 5 advance: SceneSwitch (Engine + AI)**: rules/20 §スイッチ — scene 5 枚埋まり時の handUseCard を engine.flow に追加、AI move-enumerator + heuristic 拡張 (1409 PASS / 1000戦 smoke 完走)
- [x] **Phase 5 advance: SceneSwitch UI**: SceneSwitchPickerModal (presentation 既存) を runHandUseFlow に接続。useSceneSwitchPickerStore 新規 + EngineAction.handUseCardSwitch 追加 + Playmat wrapper (常時同一 JSX で React 19 fiber static flag 回避)。1414 PASS / Playwright で modal renders / pick / cancel すべて検証済
- [x] **Phase 5 advance: Hirameki E2E 結合検証 + bug fix**: integration test 5 件 (D08013/D08019 fire/skip/non-hirameki/連続/CharStun) で全経路実証。listener bug 発見・修正 (`_resetHiramekiRegistered` 追加で `event._resetRegistry()` 後の再登録可能化) + RandomPolicy.chooseHiramekiTrigger fallback (50/50)。1419 PASS / 1000戦 smoke 完走 0 regression
- [x] **Phase 5 advance: Misread E2E (Human defender 経路) + bug fix**: integration test 6 件 (side-channel set / 候補なし / 複数 / sleep&stun除外 / dispatch resolve / empty picks) で経路実証。同じ `_registered` bug を修正 (`_resetMisreadRegistered` 追加) + RandomPolicy.chooseMisreadTriggers fallback (per-candidate 50/50)。1425 PASS / 1000戦 smoke 完走 0 regression
- [x] **Phase 5 advance: Souza (rules/13 捜査X) engine atom + AI auto-order**: 新規 atom 'souza' を ATOM_VERBS + AtomVerb + atom-handlers に追加。AIPolicy.chooseSouzaOrder method 追加 (Heuristic=peek 順 / Random=Fisher-Yates shuffle) + cards/_shared/souzaX.ts factory + unit test 9 件。Sub-task A (CPU 経路) 完了、Sub-task B/C (UI + 「発見された」参照) は次セッション。1434 PASS / 1000戦 smoke 完走 0 regression
- [ ] Phase 5 advance: Misread UI / Souza Sub-task B/C / 「発見された」参照機構
- [ ] 残 scope-out: MCTS AI / Phase 9-G リプレイ / 9-H パフォーマンス計測

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) etc — Phase 7 / 8 系
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成
- [2026-05-17-2](sessions/2026-05-17-2.md) — Phase 9-A〜9-E 一気通貫 (engine bug + UI polish)
- [2026-05-17-3](sessions/2026-05-17-3.md) — Phase 5 advance prep + C+D scope-out + React Internal error 解消

## 次セッション

- [NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md) — 次セッション開始用
- Phase 5 advance または demo fixture cardId 修正から brainstorming で選ぶ
