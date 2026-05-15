# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 8 (UI Interactions) 進行中 — Task 8.1〜8.6 (推理 + ネクストヒント) 完了 ✅
**最新コミット**: `21b3b9f` Phase 8.6 ネクストヒントフロー UI 統合 (4 tests)
**テスト状況**: 1191 PASS / 135 test files / typecheck clean / docs:check clean
**ブラウザ表示**: 推理 + ネクストヒント + endTurn が end-to-end 動作 (5177)

**未コミット作業 (中断時点)**:

- `tests/ui/hooks/useActionsPanelFlow.assist.test.ts` (RED tests 9件: assist 4 + solveCase 5)
- impl 未着手 — 再開時に runAssistFlow / runSolveCaseFlow + EngineAction 拡張 (`assist` / `solveCase`)

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
  - [ ] **8.6 残**: 手札の使用 / アシスト (RED 4 件あり) / 事件解決 (RED 5 件あり) /
        パートナー能力 / 宣言能力 / アクション宣言 (target + 9段階 state machine)
  - [ ] 8.7-8.11 各種モーダル / 効果スタック UI / AI 進行 / アニメ / E2E
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 8.6 残部分** (アシスト / 事件解決 / 手札使用 / アクション宣言 / 宣言能力)

**まず手を付けるのが楽な順**:

1. **アシスト + 事件解決** ← RED tests 9 件すでに書いてある (`tests/ui/hooks/useActionsPanelFlow.assist.test.ts`)
   - 実装: `useActionsPanelFlow.runAssistFlow` / `runSolveCaseFlow` を新設
   - `useEngineDispatch` の `EngineAction` discriminated union に `assist` / `solveCase` を追加
     - can-check は `src/ai/move-enumerator.ts` の `canAssist` / `canSolveCase` ロジックを inline
     - 実行は `engine.mutate.partner.assist` / `engine.mutate.partner.solveCase` を呼ぶ
       (engine.flow にラッパーがないため、AI 側 `src/ai/policy.ts:117/126` と同じ)
   - `ActionsPanel`: 6 行動 + 「アシスト」「事件解決」の 2 item 追加 (Phase 8.6 暫定)
     ※将来は ActionMenu component に移す
   - `Playmat`: `onActionItemClick('assist')` / `('solve-case')` を配線

2. **手札の使用** — 拡大手札の HandCard クリックを起点にする
   - 既存の `HandZone.expanded` モード + `onCardClick` prop は実装済 (Phase 8.5)
   - `runHandUseFlow(cardId)` を追加: `canHandUseCard` check → ConfirmModal → dispatch handUseCard
   - キャラの場合は 8.6 後半で「現場スロット選択」UI を追加 (今は flag セットのみで OK、登場処理は Phase 5 listener)

3. **パートナー能力 / 宣言能力** — cost 解決と Phase 5 listener が絡むため複雑。
   別タスクで設計検討。

4. **アクション宣言** — target picker + 9 段階 state machine + ガード/コンタクト/カットイン。
   ui-action-flows.md / ui-modal-flows-contact.md を読み直して Phase 8.7+ で着手。

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
