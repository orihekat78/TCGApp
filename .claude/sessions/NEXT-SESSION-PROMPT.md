# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Phase 8 完全クローズ達成済 (2026-05-17 push 済)。
次フェーズの作業を開始したい。

## 完了状態

**Phase 8 完全クローズ達成** ✅ (Commit 1〜6 全完了 / 1377 PASS / 182 files / typecheck clean)

- Phase 7 / 7.5 / 8.1-8.10 (UI シェル / ActionsPanel / 推理 / 手札 / 各種演出 / チュートリアル L0-L13) ✅
- 完全クローズ Commit 1 (`eb21e8c`) — Guard/CutInDisguise picker modal UI
- 完全クローズ Commit 2 (`770624e`) — per-step action dispatch + ContactFlowDriver
- 完全クローズ Commit 2.5 (`62fa8b2`) — playTurn pauseOnAction + useOppTurnDriver per-step
- 完全クローズ Commit 3a (`5d1620d`) — Hirameki end-to-end
- 完全クローズ Commit 3b (`b50571a`) — Misread infrastructure (Phase 5 prep)
- 完全クローズ Commit 4 (`3360006`) — Souza/SceneSwitch modal scaffolds (Phase 5 prep)
- 完全クローズ Commit 5 (`60be8b4`) — 効果スタック reorder UI
- 完全クローズ Commit 6 (`135a12b`) — human-vs-CPU E2E

## Phase 5 prep 残作業 (実カード追加と同時)

これらは MVP デッキに該当カードがないため infrastructure のみ完成。
Phase 5 で実カード追加時に engine 統合 + 動作確認:
1. Misread (rules/13): reasoning per-step dispatch 化が必要 → human defender modal 実発動
2. Souza (rules/13): engine atom 追加 + listener 接続 + dispatch
3. SceneSwitch (rules/20): sceneSwitch effect で removeUid を user pick できる経路
4. Hirameki: 実カード経由の action[case] フロー結合 (現状 listener 単体で動作確認済)

## 次フェーズ候補 (Phase 9 = Polish)

- **9-A**: 1000戦 AI vs AI smoke + チューニング
- **9-B**: チュートリアル L14+ (高度なシナリオ)
- **9-C**: 法務スタンス準拠の画像フェッチ強化 (キャッシュ / fallback)
- **9-D**: ローカル保存・リプレイ機能
- **9-E**: パフォーマンス計測 (ターン時間 / メモリ)
- **Phase 5 advance**: 実カード追加 (CT-D08/D11 以外、または同セット未実装カード)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -10` で最新 commit を確認 (`135a12b` Phase 8 closure E2E)
3. 上記候補から 1 つ選んで brainstorming → plan → 実装
4. CLAUDE.md §README.md 運用義務に従い、各フェーズ完了時に README 更新

## エッジケース (CLAUDE.md §設計レビュー)

- カード追加時の touched files が 3 を超えないか
- 既存カードへの破壊的変更がないか
- rules/01-30 との整合性
```

---

## 参考

- 直近 commit: `135a12b` (Commit 6 — human-vs-CPU E2E / Phase 8 完全クローズ達成)
- ベース: 1377 PASS / 182 files / typecheck clean / docs:check clean
- 主要 spec:
  - `.claude/research/plans/2026-05-11-mvp-implementation/` — Phase 別計画
  - `.claude/specs/2026-05-11-ui-action-flows.md`
  - `.claude/specs/2026-05-11-ui-modal-flows-other.md`
