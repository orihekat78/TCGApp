# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Phase 9-A クローズ達成済 (2026-05-17)。
次フェーズの作業を開始したい。

## 完了状態

**Phase 9-A クローズ達成** ✅ 1000戦 smoke ベースライン取得 / 1393 PASS / 184 files / typecheck clean

- Phase 0-8 完全クローズ達成済 (engine + 47 カード + UI シェル + E2E)
- 9-A C1 (`e4878ba`) — aggregate / format-md pure functions + 15 tests
- 9-A C2 (`e540f38`) — scripts/smoke/run-1000.ts runner + npm run smoke:1000
- 9-A C2.5 (`0f3fc73`) — anomaly Markdown 表示上限 20 件 (CLAUDE.md 100行制約)
- 9-A C3 (`afd9d17`) — 初回レポート .claude/reports/smoke-2026-05-17.{json,md}

## 9-A 主要観測

- 1000戦 heuristic × heuristic / 20.6秒 / **0 例外** / 100% turn-cap (200ターン上限)
- engine 信頼度: Phase 8 で増えた path 含めて 0 invariant failure
- AI 弱点: HeuristicPolicy mirror match は決着不能 (既知の Phase 7+ tuning item と整合)

## Phase 5 prep 残作業 (実カード追加と同時)

MVP デッキ (CT-D08/D11) に該当カードがないため infrastructure のみ完成済:
1. Misread (rules/13): reasoning per-step dispatch 化 → human defender modal 実発動
2. Souza (rules/13): engine 'souza' atom 追加 + listener + dispatch
3. SceneSwitch (rules/20): sceneSwitch effect で removeUid を user pick できる経路
4. Hirameki: 実カード経由の action[case] フロー結合 (listener 単体動作確認済)

## 次フェーズ候補

- **9-B (推奨)**: HeuristicPolicy チューニング — mirror match を決着させる勝利駆動の重み調整。
  smoke レポートを before/after で比較し勝率分布を改善目標 (例: 40〜60%) に近づける。
- **9-C**: 法務スタンス準拠の画像フェッチ強化 (キャッシュ / fallback)
- **9-D**: ローカル保存・リプレイ機能
- **9-E**: パフォーマンス計測 (ターン時間 / メモリ)
- **Phase 5 advance**: 実カード追加 (CT-D08/D11 以外、または同セット未実装カード)

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -10` で最新 commit を確認
3. `.claude/reports/smoke-2026-05-17.md` で 9-A ベースラインを把握
4. 上記候補から 1 つ選んで brainstorming → plan → 実装
5. CLAUDE.md §README.md 運用義務に従い、各フェーズ完了時に README 更新

## エッジケース (CLAUDE.md §設計レビュー)

- 9-B 着手時: HeuristicPolicy の重み調整は engine ではなく ai/policies/heuristic.ts への変更で完結するか
- 1000戦 smoke 再実行で勝率改善 (タイムアウト ≤ 5%) を達成できるか
- rules/01-30 との整合性
```

---

## 参考

- 直近 commit: 9-A C4 ドキュメント更新後の HEAD (origin/main push 済)
- ベース: 1393 PASS / 184 files / typecheck clean / docs:check clean
- 主要 spec:
  - `.claude/research/plans/2026-05-11-mvp-implementation/` — Phase 別計画
  - `.claude/reports/smoke-2026-05-17.md` — Phase 9-A ベースラインレポート
