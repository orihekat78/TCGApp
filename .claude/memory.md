# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 8 (UI Interactions) 進行中 — Task 8.1〜8.7b 完了 ✅
**最新コミット**: Commit I — Phase 8.7b opp ターン自動進行ドライバ (5 tests)
**テスト状況**: 1222 PASS / 139 test files / typecheck clean / docs:check clean
**ブラウザ表示**: ゲームが end-to-end で回る — self ターン全行動 + endTurn → opp が HeuristicPolicy で自動消化 → self に戻る

**未コミット作業**: なし

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
  - [x] **8.6 推理** フロー UI 統合 (target picker + ハイライト + dispatch)
  - [x] **8.6 ネクストヒント** フロー UI 統合 (`21b3b9f`, 4 tests)
  - [x] **8.6 アシスト + 事件解決** フロー UI 統合 (Commit F, 8 tests)
  - [x] **8.6 手札の使用** フロー UI 統合 (Commit G, 6 tests) — HandZone.onCardClick + canUse 連動
  - [x] **8.7a アクション宣言** フロー UI 統合 (Commit H, 12 tests) — source + target 2 段階 picker、相手 CPU は ガード/カットイン/変装なし簡略
  - [x] **8.7b opp ターン自動進行** (Commit I, 5 tests) — useOppTurnDriver + HeuristicPolicy + flow.endTurn 連携。試合が end-to-end で回るようになった
  - [ ] **8.7c 残**: CPU 側 ガード/カットイン/変装 政策強化 (現状 passGuard 固定) /
        パートナー能力 / 宣言能力 / PvP 用モーダル UI (Phase 9.x)
  - [ ] 8.7-8.11 各種モーダル / 効果スタック UI / AI 進行 / アニメ / E2E
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 8.6 残部分** (アシスト / 事件解決 / 手札使用 / アクション宣言 / 宣言能力)

**まず手を付けるのが楽な順**:

1. **パートナー能力 / 宣言能力** — cost 解決と Phase 5 listener が絡むため複雑。
   別タスクで設計検討。

2. **Phase 8.7b: ガード判定モーダル / カットイン / 変装** — ui-modal-flows-contact.md 準拠。
   現状は相手 CPU の自動 passGuard 経路のみ実装、対話的 UI 未着手。

3. **手札の使用 後続ポリッシュ** — キャラ登場時の現場スロット選択 UI、
   カード名 (HandCardMeta.name) を確認モーダル本文に出す。
   現状 cardId 直 表示なので最低限の使い勝手のみ。

4. **アクション宣言 ポリッシュ** — 確認モーダルにキャラ名 + AP 表示、
   target 候補 0 件のときに source picker を表示しない (UX 改善)。

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
- [2026-05-15-5](sessions/2026-05-15-5.md) — Phase 8.5 polish + 8.6 推理フロー (session 5)
- [2026-05-15-6](sessions/2026-05-15-6.md) — **Phase 8.6 ネクストヒント + アシスト中断** (session 6)

## 主要参照

- [research/plans/2026-05-11-mvp-implementation/INDEX.md](research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [specs/INDEX.md](specs/INDEX.md)
- [CLAUDE.md](CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
