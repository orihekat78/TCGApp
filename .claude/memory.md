# 作業ログ — 名探偵コナンTCG プロジェクト

## 現在地

**フェーズ**: Phase 8 (UI Interactions) 進行中 — Task 8.1〜8.8d + 8.4 + 8.10a/b/c/d/e 完了 ✅
**最新コミット**: Commit V — Phase 8.10e コンタクト判定 log 追加 (3 tests)
**テスト状況**: 1275 PASS / 153 test files / typecheck clean / docs:check clean
**ブラウザ表示**: コンタクト判定 (AP 比較) の hit/miss がトーストに表示されるようになった (例: 「自分 / 判定 [hit]」)

**未コミット作業**: なし

## 進捗トラッカー

- [x] Phase 0-6: engine + 47 カード + AI (991 tests baseline)
- [x] **Phase 7 + 7.5 UI Shell + layout pivot ✅** — [sessions/2026-05-15](sessions/2026-05-15.md) / [-2](sessions/2026-05-15-2.md)
- [x] **Phase 8.1-8.3 hooks 基盤 ✅** — [-3](sessions/2026-05-15-3.md)
- [x] **Phase 8.5 / 8.6 ActionsPanel + 推理 / ネクストヒント ✅** — [-5](sessions/2026-05-15-5.md) / [-6](sessions/2026-05-15-6.md)
- [x] **Phase 8.6 残 + 8.7a-e CPU コンタクト応答 ✅** — [-7](sessions/2026-05-15-7.md) (7 commits, 47 tests)
- [x] **Phase 8.8 + Task 8.4 + Phase 8.10 ✅** — [-8](sessions/2026-05-15-8.md) (10 commits, 38 tests)
- [x] **Task 8.4b 正規 turn-1 setup wire** (Commit X, 6 tests) — deckBuilder + gameStarter + GameSetupModal の 2 ボタン化
- [x] **Phase 9a-1 チュートリアル骨格 + L0** (Commit Y, 8 tests) — tutorialStore + TutorialOverlay + L0「ゲーム目的」3 ステップ
- [x] **Phase 9a-2 チュートリアル L1-L5** (Commit Z, 3 tests) — 13 step 追加 (L1 デッキ / L2 場 / L3 ターン / L4 推理 / L5 パートナー)
- [x] **Phase 9b チュートリアル L6-L10 コンタクト** (Commit AA) — 10 step 追加 (L6 アクション宣言 / L7 ガード / L8 AP 判定 / L9 カットイン / L10 変装)
- [x] **Phase 9c チュートリアル L11-L13 アドバンスド** (Commit AB) — 7 step 追加 (L11 ヒラメキ / アクション[事件] / L12 リフレッシュ / 痕跡 / L13 MR)
- [x] **Phase 8.10f コンタクト判定フラッシュ** (Commit AC, 4 tests) — ContactFlash 新規 (hit=赤 / miss=青) を App.tsx にマウント
- [x] **Phase 8.10g-1 証拠追加バンプ** (Commit AD) — count-overlay を count 値 key で remount → CSS keyframe で拡大/光る
- [ ] **次のタスク**: Phase 8.10g-2 (リムーブ fade-out / FLIP 基盤) / PvP モーダル UI / 9d インタラクティブ強化
- [ ] Phase 9: Polish (1000戦/チュートリアル)

## 次セッション開始時の最優先タスク

⭐ **Task 8.4b: 正規 setup wire** (engine.flow.setup を使った turn-1 初期化 / DeckPair 構築 / マリガン UI)

次の候補:
1. **Task 8.4b** — sampleGameState 代替の正規初期化 (現状は中盤状態で開始)
2. **Phase 8.10 残** — 画面フラッシュ / リムーブフェードアウト / 証拠追加演出
3. **Phase 9.x PvP モーダル UI** — 対人対戦時のガード/カットイン/変装モーダル

## 次セッション開始用プロンプト

⭐ **[sessions/NEXT-SESSION-PROMPT.md](sessions/NEXT-SESSION-PROMPT.md)** — 新セッションでコピペ用

## 過去セッションログ

- [2026-05-10](sessions/2026-05-10.md) — 法務・ルール・MVP決定
- [2026-05-11](sessions/2026-05-11.md) ほか — Phase 0-3
- [2026-05-12](sessions/2026-05-12.md) — Phase 4-5
- [2026-05-14-2](sessions/2026-05-14-2.md) — Phase 5 fix + Phase 6 + Obsidian × Engine 統合
- [2026-05-15](sessions/2026-05-15.md) — Phase 7 UI Shell 完了 (session 1)
- [2026-05-15-2](sessions/2026-05-15-2.md) — Phase 7.5 layout pivot (session 2)
- [2026-05-15-3](sessions/2026-05-15-3.md) — Phase 8.1 useEngineDispatch + 8.2 useTargetPicker
- [2026-05-15-5](sessions/2026-05-15-5.md) — Phase 8.5 polish + 8.6 推理フロー (session 5)
- [2026-05-15-6](sessions/2026-05-15-6.md) — Phase 8.6 ネクストヒント + アシスト中断 (session 6 開始引継ぎ)
- [2026-05-15-7](sessions/2026-05-15-7.md) — Phase 8.6 残 + Phase 8.7 シリーズ (session 7)
- [2026-05-15-8](sessions/2026-05-15-8.md) — Phase 8.8 + Task 8.4 + Phase 8.10 シリーズ (session 8)

## 主要参照

- [research/plans/2026-05-11-mvp-implementation/INDEX.md](research/plans/2026-05-11-mvp-implementation/INDEX.md)
- [specs/INDEX.md](specs/INDEX.md)
- [CLAUDE.md](CLAUDE.md) — 規約 (骨格凍結原則・共通クラス運用)
