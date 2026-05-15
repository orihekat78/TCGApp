# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 8 (UI Interactions) 進行中 — Task 8.1〜8.6 完了 ✅
**最新コミット**: `b407718` Phase 8.6 推理フロー UI 統合 (target picker + ハイライト + dispatch)
**テスト状況**: 1187 PASS / 134 test files / typecheck clean / docs:check clean
**ブラウザ表示**: 推理フロー end-to-end 動作確認済 (推理→ハイライト→クリック→確認→sleep化)

## 進捗トラッカー

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] **Phase 7: UI Shell ✅** (15 tasks, 1132 tests) — [sessions/2026-05-15](sessions/2026-05-15.md)
- [x] **Phase 7.5: layout pivot ✅** (3 commits) — [sessions/2026-05-15-2](sessions/2026-05-15-2.md)
- [ ] **Phase 8: UI Interactions** ← 進行中
  - [x] **8.1** `useEngineDispatch` — [sessions/2026-05-15-3](sessions/2026-05-15-3.md)
  - [x] **8.2** `useTargetPicker` — [sessions/2026-05-15-3](sessions/2026-05-15-3.md) (#8.2 追記)
  - [x] **8.3** `useConfirmation` — [sessions/2026-05-15-4](sessions/2026-05-15-4.md)
  - [ ] 8.4 ゲーム開始モーダル (8.5 を先行のため後回し)
  - [x] **8.5** ActionsPanel onClick 配線 (endTurn + ConfirmModal) — [sessions/2026-05-15-5](sessions/2026-05-15-5.md)
  - [x] **8.5 polish** HandZone 縮小/拡大 + narrator/log を ActionsPanel に集約 + 大型 scene カード等
  - [x] **8.6** 推理フロー UI 統合 (target picker + ハイライト + dispatch)
  - [ ] 8.6 コンタクトモーダル
  - [ ] 8.7-8.11 各種モーダル / 効果スタック UI / AI 進行 / アニメ / E2E
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 8 Task 8.6 残部分** (アクション宣言 / コンタクト / アシスト / 事件解決 etc)

8.6 で推理だけ wire 済。残り 6 アクションを順次:

- 手札の使用 (キャラ登場 vs イベント解決の分岐 + 色制限 + FILE 制限)
- ネクストヒント (FILE 最上部 → 手札、続けて optional カード使用)
- パートナー能力 / 宣言能力 (cost 解決 + Phase 5 listener)
- アクション宣言 (target picker + 9段階 state machine + ガード判定)
- アシスト (強警告 confirm + パートナー sleep + FILE 7枚チェック)
- 事件解決 (勝利予告 confirm + アシスト済みターン判定)

Task 8.4 (ゲーム開始モーダル) は sampleGameState で代替中、必要になったら着手。

### Phase 8 完了後の layout polish TODO

Phase 7.5 で大枠 layout は揃ったが、ユーザ参考画像との完璧な視覚一致は未達成。
Phase 8 完了後にもう 1 ラウンド polish 予定: カード画像実フェッチ / 動的 actionMode /
学生 tooltip / mat 寸法 / モーダル類追加。詳細: [sessions/2026-05-15-2](sessions/2026-05-15-2.md)

## 次セッション開始用プロンプト

⭐ **[sessions/NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md)** — 新セッションでコピペ用

## 過去セッションログ

- [2026-05-10](sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11](sessions/2026-05-11.md) ほか — Phase 0-3
- [2026-05-12](sessions/2026-05-12.md) — Phase 4-5
- [2026-05-14](sessions/2026-05-14.md) — Phase 5 fix + Phase 6 (Heuristic policy 申し送り)
- [2026-05-14-2](sessions/2026-05-14-2.md) — Obsidian × Engine 統合
- [2026-05-15](sessions/2026-05-15.md) — Phase 7 UI Shell 完了 (session 1)
- [2026-05-15-2](sessions/2026-05-15-2.md) — Phase 7.5 layout pivot (session 2)
- [2026-05-15-3](sessions/2026-05-15-3.md) — Phase 8.1 useEngineDispatch + 8.2 useTargetPicker
- [2026-05-15-4](sessions/2026-05-15-4.md) — Phase 8.3 useConfirmation (session 4)
- [2026-05-15-5](sessions/2026-05-15-5.md) — **Phase 8.5 polish + 8.6 推理フロー** (session 5)

## 主要参照

- [research/plans/2026-05-11-mvp-implementation/INDEX.md](research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [specs/INDEX.md](specs/INDEX.md)
- [CLAUDE.md](CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
