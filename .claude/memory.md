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
- [ ] Phase 5 advance: 実カード追加 + Misread / Souza / SceneSwitch engine 統合
- [ ] 残 scope-out: demo fixture cardId / React key 重複 / MCTS AI

## セッションログ index

- [2026-05-15](sessions/2026-05-15.md) etc — Phase 7 / 8 系
- [2026-05-17](sessions/2026-05-17.md) — Phase 8 完全クローズ達成
- [2026-05-17-2](sessions/2026-05-17-2.md) — Phase 9-A〜9-E 一気通貫 (engine bug + UI polish)

## 次セッション

- [NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md) — 次セッション開始用
- Phase 5 advance または demo fixture cardId 修正から brainstorming で選ぶ
