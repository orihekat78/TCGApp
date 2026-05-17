# 次セッション キックオフプロンプト

新しい Claude Code セッションを開始したら、以下を最初のユーザメッセージとしてコピペしてください。

---

## コピペ用プロンプト

```text
名探偵コナンTCG MVP — Phase 9-B クローズ達成済 (2026-05-17)。
次フェーズの作業を開始したい。

## 完了状態

**Phase 9-B クローズ達成** ✅ engine 整合性 4 バグ修正 + Heuristic チューニング / 1394 PASS / 184 files

- Phase 0-8 完全クローズ達成済 (engine + 47 カード + UI シェル + E2E)
- 9-A C1〜C3: 1000戦 smoke runner + 初回ベースラインレポート
- 9-B C2 (`8490fd0`) — B1: `clearNamed` を endTurn で呼出 (名乗り永続化バグ)
- 9-B C3 (`7b9984d`) — B2: `handUseCard` でキャラを scene に登場 / B3: AI が cost picker indices を populate
- 9-B C3.5 (`a0d4c1c`) — B4: Heuristic NextHint gate (fileLen>=8) で assist 閾値保護
- 9-B C4 (`0adf3a4`) — 修正後 1000戦レポート

## 9-B 主要成果 (Before / After)

| 指標 | 9-A baseline | 9-B 修正後 |
|---|---|---|
| timeouts | 1000 (100%) | 0 (0%) ✅ |
| exceptions | 0 | 0 (維持) |
| winsA / winsB | 0 / 0 | 524 / 476 (52.4% / 47.6%) |
| avgTurns | 201.0 | 10.35 |
| runtime | 20.6s | 3.4s |

## 残課題 (Phase 9-B 監査で発見、本セッション out of scope)

| ID | 内容 | 影響 |
|---|---|---|
| B5 | `mutate.char.removeAllSetAndStacked` 0 callers (rules/16 セット/重ね解除) | MVP デッキ非該当、Phase 5 advance 時に対応 |
| B6 | refresh 時の 痕跡 hook emission なし (rules/13/26) | 痕跡能力カード MVP 非含有、smoke 影響なし |

## Phase 5 prep 残作業 (実カード追加と同時)

MVP デッキ (CT-D08/D11) に該当カードがないため infrastructure のみ完成済:
1. Misread (rules/13): reasoning per-step dispatch 化 → human defender modal 実発動
2. Souza (rules/13): engine 'souza' atom 追加 + listener + dispatch
3. SceneSwitch (rules/20): sceneSwitch effect で removeUid を user pick できる経路
4. Hirameki: 実カード経由の action[case] フロー結合

## 次フェーズ候補

- **9-C**: ローカル保存・リプレイ機能 (GameState スナップショット + 再生 UI)
- **9-D**: 法務スタンス準拠の画像フェッチ強化 (キャッシュ / fallback)
- **9-E**: パフォーマンス計測 (ターン時間 / メモリ)
- **Phase 5 advance**: 実カード追加 + B5/B6 修正 + Misread/Souza/SceneSwitch engine 統合
- **9-B フォローアップ**: AI 強化版 (MCTS / 重み付き scoring) — 現状の greedy 改良の次段

## 作業手順

1. `.claude/CLAUDE.md` 規約を確認
2. `git log --oneline -15` で 9-B の 5 コミットを確認
3. `.claude/reports/smoke-2026-05-17-phase9b.md` で改善内容を把握
4. 上記候補から 1 つ選んで brainstorming → plan → 実装
5. CLAUDE.md §README.md 運用義務に従い、各フェーズ完了時に README 更新

## エッジケース (CLAUDE.md §設計レビュー)

- 9-C 着手時: localStorage / IndexedDB の選択、SSR-safety の検討
- B5/B6 を Phase 5 advance で扱う際の rules/16/26 整合性
- engine 修正があれば骨格凍結原則の §例外条件 (バグ修正のみ) を厳守
```

---

## 参考

- 直近 commit: 9-B C5 ドキュメント更新後の HEAD (push 待ち)
- ベース: 1394 PASS / 184 files / typecheck clean / docs:check clean
- 主要レポート:
  - `.claude/reports/smoke-2026-05-17.md` — 9-A baseline (engine バグ顕在化前)
  - `.claude/reports/smoke-2026-05-17-phase9b.md` — 9-B 修正後 (0 timeout / 平均 10.35ターン)
