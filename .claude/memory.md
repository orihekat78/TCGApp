# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 8 (UI Interactions) 進行中 — Task 8.1 完了 ✅
**最新コミット**: `cded622` (commit 待ち: useEngineDispatch hook)
**テスト状況**: 1145 PASS / 129 test files / typecheck (src+scripts) clean / docs:check clean
**ブラウザ表示**: `npm run dev` で 13 エリア描画 (操作配線は Task 8.5 で着手)

## 進捗トラッカー

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] **Phase 7: UI Shell ✅** (15 tasks, 1132 tests) — [sessions/2026-05-15](sessions/2026-05-15.md)
- [x] **Phase 7.5: layout pivot ✅** (3 commits) — [sessions/2026-05-15-2](sessions/2026-05-15-2.md)
- [ ] **Phase 8: UI Interactions** ← 進行中
  - [x] **8.1** `useEngineDispatch` — [sessions/2026-05-15-3](sessions/2026-05-15-3.md)
  - [ ] 8.2 `useTargetPicker`
  - [ ] 8.3 `useConfirmation`
  - [ ] 8.4 ゲーム開始モーダル
  - [ ] 8.5 ActionsPanel onClick 配線
  - [ ] 8.6 コンタクトモーダル
  - [ ] 8.7-8.11 各種モーダル / 効果スタック UI / AI 進行 / アニメ / E2E
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Phase 8 Task 8.2** `useTargetPicker`

詳細プラン: [phase-8-ui-interactions.md](research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md)

spec: `.claude/specs/2026-05-11-ui-action-flows.md` — クリック+確認 UX (Q8 MTGA型) /
candidate ハイライト → クリック → 確認 → resolve / 0枚選択可スキップ。
推理 / アクション宣言 / 宣言能力 / アシスト 等で共通利用する基盤 hook。

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
- [2026-05-15-3](sessions/2026-05-15-3.md) — **Phase 8.1 useEngineDispatch** (session 3)

## 主要参照

- [research/plans/2026-05-11-mvp-implementation/INDEX.md](research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [specs/INDEX.md](specs/INDEX.md)
- [CLAUDE.md](CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
